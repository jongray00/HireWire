import { getEmployeeById, updateEmployeeDocuments } from '@/lib/db';

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const employeeId = formData.get('employeeId');
    const spaceUrl = formData.get('spaceUrl');
    const projectId = formData.get('projectId');
    const apiToken = formData.get('apiToken');

    if (!file || !employeeId || !spaceUrl || !projectId || !apiToken) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Upload to DataSphere REST API
    const dsFormData = new FormData();
    dsFormData.append('file', file);
    dsFormData.append('chunking_strategy', 'paragraph');

    const spaceDomain = spaceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const dsUrl = `https://${spaceDomain}/api/datasphere/documents`;

    const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64');

    const dsResponse = await fetch(dsUrl, {
      method: 'POST',
      headers: { 'Authorization': authHeader },
      body: dsFormData,
    });

    if (!dsResponse.ok) {
      const errText = await dsResponse.text();
      console.error('DataSphere upload failed:', dsResponse.status, errText);
      return Response.json({
        success: false,
        error: `DataSphere upload failed: ${dsResponse.status}`,
      }, { status: 502 });
    }

    const dsResult = await dsResponse.json();
    const documentId = dsResult.document_id || dsResult.id;

    if (!documentId) {
      return Response.json({ success: false, error: 'No document_id returned from DataSphere' }, { status: 502 });
    }

    // Add document to employee's documents array in DB
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return Response.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const documents = employee.documents ? JSON.parse(employee.documents) : [];
    documents.push({
      document_id: documentId,
      filename: file.name,
      size: file.size,
      uploaded_at: new Date().toISOString(),
    });

    updateEmployeeDocuments(employeeId, documents);

    return Response.json({
      success: true,
      document: {
        document_id: documentId,
        filename: file.name,
        size: file.size,
      },
    });
  } catch (error) {
    console.error('Upload document error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
