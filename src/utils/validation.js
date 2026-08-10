export function validateHeader(header) {
  const errors = {}
  if (!header.inventoryOrganization) errors.inventoryOrganization = 'Inventory Organization is required.'
  if (!header.transactionType) errors.transactionType = 'Transaction Type is required.'
  if (!header.requiredDate) errors.requiredDate = 'Required Date is required.'
  return errors
}
