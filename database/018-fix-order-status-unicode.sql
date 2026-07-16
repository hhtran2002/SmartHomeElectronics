-- Use Unicode code points so SQLCMD code-page settings cannot corrupt Vietnamese text.
UPDATE dbo.OrderStatus
SET StatusName = NCHAR(272) + NCHAR(227) + NCHAR(32) + NCHAR(120) + NCHAR(225)
  + NCHAR(99) + NCHAR(32) + NCHAR(110) + NCHAR(104) + NCHAR(7853) + NCHAR(110)
WHERE StatusCode = 'Confirmed';
