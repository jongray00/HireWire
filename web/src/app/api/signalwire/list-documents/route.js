import { getEmployeeById } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');

    if (!employeeId) {
      return Response.json({ success: false, error: 'Missing employeeId' }, { status: 400 });
    }

    const employee = getEmployeeById(employeeId);
    if (!employee) {
      return Response.json({ success: false, error: 'Employee not found' }, { status: 404 });
    }

    return Response.json({
      success: true,
      documents: employee.documents ? JSON.parse(employee.documents) : [],
    });
  } catch (error) {
    console.error('List documents error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
