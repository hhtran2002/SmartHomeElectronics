SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;

BEGIN TRANSACTION;

-- "Paid" is a payment state. A successful online payment confirms the order
-- so that it can enter the fulfilment workflow.
IF EXISTS (SELECT 1 FROM dbo.OrderStatus WHERE StatusCode = 'Paid')
  AND NOT EXISTS (SELECT 1 FROM dbo.OrderStatus WHERE StatusCode = 'Confirmed')
BEGIN
  UPDATE dbo.OrderStatus
  SET StatusCode = 'Confirmed',
      StatusName = N'Đã xác nhận',
      SortOrder = 3
  WHERE StatusCode = 'Paid';
END;

-- "Refunded" belongs to PaymentStatus. Keep the order cancelled and preserve
-- the payment's Refunded state instead of exposing a second terminal order state.
IF EXISTS (SELECT 1 FROM dbo.OrderStatus WHERE StatusCode = 'Refunded')
BEGIN
  DECLARE @CancelledStatusId TINYINT = (
    SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = 'Cancelled'
  );
  DECLARE @RefundedStatusId TINYINT = (
    SELECT OrderStatusId FROM dbo.OrderStatus WHERE StatusCode = 'Refunded'
  );

  IF @CancelledStatusId IS NULL
    THROW 50001, 'OrderStatus Cancelled is required before this migration can run.', 1;

  UPDATE dbo.SalesOrder
  SET OrderStatusId = @CancelledStatusId
  WHERE OrderStatusId = @RefundedStatusId;

  UPDATE dbo.OrderStatusHistory
  SET FromStatusId = @CancelledStatusId
  WHERE FromStatusId = @RefundedStatusId;

  UPDATE dbo.OrderStatusHistory
  SET ToStatusId = @CancelledStatusId
  WHERE ToStatusId = @RefundedStatusId;

  DELETE FROM dbo.OrderStatus
  WHERE OrderStatusId = @RefundedStatusId;
END;

COMMIT TRANSACTION;
