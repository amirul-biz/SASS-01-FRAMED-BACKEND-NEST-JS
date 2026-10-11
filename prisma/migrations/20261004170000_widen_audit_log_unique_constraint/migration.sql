-- AlterTable: widen the unique constraint so an order-status-only event (e.g. delivery, where
-- the payment stays PAID but the order moves PROCESSING -> DELIVERED) can coexist with the row
-- already written when the payment first reached that same toStatus.
DROP INDEX "merchant_transaction_audit_logs_payment_id_to_status_key";

CREATE UNIQUE INDEX "merchant_transaction_audit_logs_payment_id_to_status_to_or_key" ON "merchant_transaction_audit_logs"("payment_id", "to_status", "to_order_status");
