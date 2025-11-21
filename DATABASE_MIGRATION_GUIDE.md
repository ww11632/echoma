# Database Migration Guide

This guide explains how to apply database migrations for new features in Echoma.

## 📋 Overview

Echoma uses Supabase for cloud data storage. Some features require database schema changes, which are managed through SQL migration files located in `supabase/migrations/`.

## 🔧 How to Apply Migrations

### Option 1: Using Supabase CLI (Recommended)

1. **Install Supabase CLI** (if not already installed):
   ```bash
   npm install -g supabase
   ```

2. **Login to Supabase**:
   ```bash
   supabase login
   ```

3. **Link your project**:
   ```bash
   supabase link --project-ref your-project-ref
   ```

4. **Apply migrations**:
   ```bash
   supabase db push
   ```

   This will apply all pending migrations in the `supabase/migrations/` directory.

### Option 2: Using Supabase Dashboard (Manual)

1. Go to your [Supabase Dashboard](https://app.supabase.com/)
2. Select your project
3. Navigate to **SQL Editor**
4. Open the migration file you need (e.g., `20241122000000_create_access_labels_table.sql`)
5. Copy the SQL content
6. Paste it into the SQL Editor
7. Click **Run** to execute the migration

## 📂 Migration Files

### Required Migrations for Current Features

| File | Feature | Required For | Priority |
|------|---------|-------------|----------|
| `20241122000000_create_access_labels_table.sql` | Access Control Labels | Cloud sync of authorization address labels | **High** |
| `20250115000000_make_description_optional.sql` | Optional Descriptions | Flexible emotion records | Medium |
| `20250116000000_create_audit_logs.sql` | Audit Logging | AI API call tracking | Medium |
| `20250116000001_create_api_keys_table.sql` | API Key Management | API key rotation | Low |
| `20250117000000_alter_audit_logs_user_id_for_anonymous.sql` | Anonymous Audit Logs | Anonymous user tracking | Low |
| `20250118000000_add_transaction_digest.sql` | Transaction Tracking | NFT minting transaction reference | Medium |

### 20241122000000_create_access_labels_table.sql

**Purpose**: Enables cloud synchronization of access control labels across devices.

**What it creates**:
- `access_labels` table to store label-to-address mappings
- Indexes for fast queries
- Row Level Security (RLS) policies for data protection
- Automatic `updated_at` timestamp trigger

**When to apply**: 
- **Required** if you want to use the Access Control Labels feature (introduced in latest update)
- Without this migration, labels will only be stored locally in `localStorage`

**How to verify**:
1. After migration, check Supabase Dashboard → Database → Tables
2. You should see a new `access_labels` table
3. Test by adding a label in the UI - it should sync to the cloud

## ⚠️ Important Notes

### Before Migrating

1. **Backup your data** (optional but recommended):
   - Export your Supabase data through the dashboard
   - Or use `supabase db dump` command

2. **Check migration order**:
   - Migrations are numbered by timestamp (YYYYMMDDHHMMSS)
   - They must be applied in chronological order
   - Supabase CLI handles this automatically

### After Migrating

1. **Verify schema**:
   - Check that new tables/columns appear in Supabase Dashboard
   - Verify RLS policies are active (Database → Policies)

2. **Test functionality**:
   - For access labels: Try adding/editing labels in the UI
   - Check browser console for any errors

## 🚨 Troubleshooting

### Migration Failed

**Error: "relation already exists"**
- The table/column already exists
- Solution: Skip this migration or drop the existing table first (⚠️ data loss)

**Error: "permission denied"**
- Your Supabase user doesn't have sufficient permissions
- Solution: Use the Supabase Dashboard SQL Editor (runs as superuser)

**Error: "syntax error"**
- SQL syntax issue in the migration file
- Solution: Check the migration file for typos, or report as a bug

### Features Not Working After Migration

1. **Clear browser cache**: Sometimes cached data conflicts with new schema
2. **Check RLS policies**: Ensure Row Level Security policies are enabled
3. **Verify migration**: Run the SQL manually in Supabase Dashboard to check for errors
4. **Check browser console**: Look for API errors or authentication issues

## 📖 Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/guides/cli)
- [Supabase Migrations Guide](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- [SQL Editor in Supabase Dashboard](https://supabase.com/docs/guides/database/overview#the-sql-editor)

## 🆘 Getting Help

If you encounter issues:
1. Check the [Troubleshooting](#troubleshooting) section above
2. Review error messages in browser console
3. Check Supabase logs in Dashboard → Logs
4. Open an issue on the project repository with:
   - Migration file name
   - Error message
   - Supabase version
   - Steps to reproduce

