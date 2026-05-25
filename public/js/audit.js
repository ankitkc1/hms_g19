document.addEventListener('DOMContentLoaded', async () => {
  const table = document.getElementById('auditTable');
  const res = await fetch('/audit/data');
  const result = await res.json();

  if (!result.success || !result.logs.length) {
    table.innerHTML = '<tr><td>No audit logs found.</td></tr>';
    return;
  }

  table.innerHTML = result.logs.map((log) => `
    <tr>
      <td>${log.action}</td>
      <td>${log.user ? log.user.email : '-'}</td>
      <td>${log.role || '-'}</td>
      <td>${log.entityType}</td>
      <td>${new Date(log.createdAt).toLocaleString('en-AU')}</td>
    </tr>
  `).join('');
});