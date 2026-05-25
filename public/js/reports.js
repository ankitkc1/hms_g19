document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('reportsGrid');
  const res = await fetch('/reports/data');
  const result = await res.json();

  if (!result.success) {
    grid.innerHTML = 'Could not load reports.';
    return;
  }

  grid.innerHTML = Object.entries(result.reports)
    .map(([key, value]) => `<div class="card"><div class="card-content"><b>${key}</b>: ${value}</div></div>`)
    .join('');
});