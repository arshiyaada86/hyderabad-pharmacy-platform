# Household patients and prescriptions

Customers are account holders and delivery contacts, not automatically the patients. The dashboard customer modal has Patients & Prescriptions, Orders and Account tabs. Reading data uses summary cards and patient cards; input forms appear only for deliberate add/edit actions.

Each patient has a stable ID, customer ID, name, age in years, the date that age was recorded, and an optional relationship. A customer can have multiple patients and a patient can have multiple prescription records. Age is recorded information rather than a date-of-birth calculation.

Prescriptions store title, prescription date, optional doctor and notes, a private image, optional account order ID, and a name/age snapshot. Corrections to a patient profile do not rewrite historical prescription snapshots. Uploads are bound to a patient before attachment. Images cannot be attached to a different patient, linked to another customer's order, exposed as public images, or deleted through the customer draft-image endpoint once saved.

Authorized admin, pharmacist and support staff use account-scoped routes. Catalog staff and customer bearer tokens cannot access these administrative patient routes. Accessing a prescription image is audited and returns an expiring signed URL. Images are JPEG/PNG/WebP; multiple prescriptions can be saved separately. PDF upload and a patient selector in the mobile checkout are not introduced by this dashboard change.

Existing orders and prescription photos remain account-level. No patient names or ages are inferred, and old prescriptions are not silently assigned to family members. Newly saved patient prescriptions can link explicitly to an existing order from the same account, including multiple patients' prescriptions linked to one household order.
