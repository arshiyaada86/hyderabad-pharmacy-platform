# Medicine Inventory

Open **Products → Add product** or click a product row. Both use the same modal; an existing product can receive another batch through **Inventory → Receive stock**. Select the existing medicine for another purchase. Leave the selection empty only for a new medicine. New medicines are drafts: publish from Products after review. A medicine photograph is required with each receipt and is shared with the medicine record.

The requested fields are grouped into Medicine, Inventory (including purchase details), Pricing and Other tabs, with a photograph preview/upload in Medicine. Manufacturer appears once; internal manufacturer aliases, registered names, image metadata and source fields are omitted from the medicine form. Quantities use the chosen sale unit (for example, one strip); no automatic pack-to-tablet conversion is performed.

## Master Data

Manage dosage forms, manufacturers, categories/subcategories, unit types, suppliers, drug schedules and storage requirements under Master Data. Dropdown values are loaded from the API. Initial examples are stored as editable database records, not UI option lists. Suppliers start empty so an actual supplier must be configured. Referenced master values cannot be renamed once used in a batch; deactivate an obsolete value and add its replacement. Receipt snapshots retain names and master IDs.

## Batches and movements

Each receipt is immutable and has its own identifier, batch number, dates, supplier, invoice, purchase cost, MRP, selling price, tax metadata and barcode. Quantity Available starts at Quantity Received. Admin-only movements record returns, damage, expiry and signed adjustments with a reason and optimistic version check. Catalog staff can receive stock but cannot directly adjust a balance. No generic batch update API is available.

Sales reserve from unexpired batches in earliest-expiry order. To preserve the app's one-price-per-product presentation, only batches matching the earliest batch's selling price and MRP are included in that customer offer. A later differently priced batch becomes available after the earlier offer is exhausted. The dashboard stock total covers all unexpired batches; customer quantity may be lower for that reason. Checkout recalculates its price fingerprint, reserves batches atomically, and records private allocations. Cancellation restores the exact allocated batches once. Expired stock is excluded at query time without waiting for a scheduled job.

Purchase price, supplier details, GST/HSN, regulatory batch metadata and allocations are not included in customer product or order responses. Selling price must not exceed MRP; no exception mechanism is enabled.

## Existing stock

Pre-batch stock remains in legacy mode until a first verified batch is received. At that transition, the old balance is recorded in `legacyStock` for reconciliation and excluded from saleable quantity; only verified batch quantities enter availability. The form warns before this transition. Do not receive the same physical stock twice. No batch numbers, expiry dates or purchase costs are fabricated. Legacy order cancellations after transition are also held for reconciliation rather than inserted into an arbitrary batch.

## Future extensions

The batch IDs, barcode field, movement ledger, supplier snapshots and price snapshots support later POS, scanner input, return approval workflows, expiry notifications and inventory reporting. Scanner hardware integration and automated expiry notifications are not part of this change. Customer returns currently require an administrator's verified movement; no self-service return workflow is introduced.

Inventory History is available at the bottom of the product modal, showing receipt quantities, suppliers, batches, expiry dates and invoice references. The separate Medicine Inventory navigation section has been removed.

Purchase history appears only at the bottom of the Inventory tab as one table: purchase date, quantity, batch, expiry, unit purchase price, purchase total and invoice. Optional invoice images upload privately with each receipt and can be opened by admin/catalog staff from that table. Historical purchases without an image or cost show that information as missing, never as a fabricated zero.
