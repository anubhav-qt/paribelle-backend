/**
 * Cash on Delivery for new checkouts and for paying an exchange's courier fee.
 * Off unless `COD_ENABLED=true` (with `NEXT_PUBLIC_COD_ENABLED=true` on the
 * storefront): the store takes prepaid orders only. Orders already placed on
 * COD, and exchanges already set to pay on delivery, carry on as before.
 */
export const codEnabled = () => process.env.COD_ENABLED === 'true';
