export const formatIDR = (n) => {
  if (n == null || isNaN(n)) return "Rp 0";
  return "Rp " + Number(n).toLocaleString("id-ID", { maximumFractionDigits: 0 });
};

export const formatDate = (iso) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};

export const formatDateTime = (iso) => {
  if (!iso) return "-";
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch { return iso; }
};

export const roleLabel = (r) => ({
  owner: "Owner",
  penagihan: "Penagihan",
  bendahara: "Bendahara",
  tim: "Tim Lapangan",
}[r] || r);

export const roleChip = (r) => `chip-${r}`;
