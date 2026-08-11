import { getPool, sql } from '../config/database.js'

const reviewModerationKey = 'ReviewModerationRequired'

export async function getReviewModerationRequired() {
  const pool = await getPool()
  const result = await pool
    .request()
    .input('settingKey', sql.VarChar(100), reviewModerationKey)
    .query(`
      SELECT TOP (1) SettingValue
      FROM dbo.AppSetting
      WHERE SettingKey = @settingKey
    `)

  // Keep moderation enabled if the setting has not been seeded yet.
  return result.recordset[0]?.SettingValue !== 'false'
}

export async function setReviewModerationRequired(required: boolean, updatedBy: number) {
  const pool = await getPool()
  await pool
    .request()
    .input('settingKey', sql.VarChar(100), reviewModerationKey)
    .input('settingValue', sql.NVarChar(1000), required ? 'true' : 'false')
    .input('updatedBy', sql.BigInt, updatedBy)
    .query(`
      MERGE dbo.AppSetting AS target
      USING (SELECT @settingKey AS SettingKey) AS source
        ON target.SettingKey = source.SettingKey
      WHEN MATCHED THEN
        UPDATE SET SettingValue = @settingValue,
                   UpdatedAt = SYSDATETIME(),
                   UpdatedBy = @updatedBy
      WHEN NOT MATCHED THEN
        INSERT (SettingKey, SettingValue, UpdatedAt, UpdatedBy)
        VALUES (@settingKey, @settingValue, SYSDATETIME(), @updatedBy);
    `)

  return { moderationRequired: required }
}
