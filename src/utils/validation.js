export function validateHeader(header) {
  const errors = {}
  if (!header.inventoryOrganization) errors.inventoryOrganization = 'Inventory Organization is required.'
  if (!header.requiredDate) errors.requiredDate = 'Required Date is required.'
  if (!header.costCenter) errors.costCenter = 'Cost Center is required.'
  return errors
}
