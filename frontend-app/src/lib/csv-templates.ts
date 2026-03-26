export function getEmployeeTemplate(): string {
  const headers = ['cedula', 'nombres', 'apellidos', 'cargo', 'departamento', 'tipo_contrato', 'fecha_ingreso', 'sueldo_base', 'cuenta_bancaria', 'banco', 'email', 'telefono'];
  const example = ['0102030405', 'Juan Carlos', 'Pérez López', 'Contador', 'Finanzas', 'indefinido', '2024-01-15', '1200.00', '2200123456', 'Banco Pichincha', 'juan@email.com', '0991234567'];
  return [headers.join(','), example.join(',')].join('\n');
}

export function downloadFile(content: string, filename: string, type: string = 'text/csv'): void {
  const blob = new Blob(['\uFEFF' + content], { type: `${type};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
