import { getEmployeeById, updateEmployeeDocuments } from '@/lib/db';

export async function POST(request) {
  try {
    const { employeeId, documentId, spaceUrl, projectId, apiToken } = await request.json();

    if (!employeeId || !documentId || !spaceUrl || !projectId || !apiToken) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Delete from DataSphere
    const spaceDomain = spaceUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
    const dsUrl = `https://${spaceDomain}/api/datasphere/documents/${documentId}`;
    const authHeader = 'Basic ' + Buffer.from(`${projectId}:${apiToken}`).toString('base64');

    const dsResponse = await fetch(dsUrl, {
      method: 'DELETE',
      headers: { 'Authorization': authHeader },
    });

    if (!dsResponse.ok && dsResponse.status !== 404) {
      const errText = await dsResponse.text();
      console.error('DataSphere delete failed:', dsResponse.status, errText);
      return Response.json({
        success: false,
        error: `DataSphere delete failed: ${dsResponse.status}`,
      }, { status: 502 });
    }

    // Remove from employee's documents array
    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return Response.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    const documents = (employee.documents ? JSON.parse(employee.documents) : []).filter(d => d.document_id !== documentId);
    updateEmployeeDocuments(employeeId, documents);

    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete document error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
