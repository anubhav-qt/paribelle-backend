# Settings Double-Quote Bug Fix

## Issue Description

When saving admin settings (specifically the marketplace name "GaliCart"), the value was getting wrapped in extra quotes after each save operation:
- First save: `GaliCart` → `"GaliCart"`
- Second save: `"GaliCart"` → `"\"GaliCart\""`
- This caused the admin URL to break: `http://localhost:3000/admin/%22%22`

## Root Cause

The issue was caused by PostgreSQL's JSONB column type behavior:

1. The `settings` table has a `value` column of type `jsonb`
2. When a simple string like "GaliCart" is stored in a JSONB column, PostgreSQL automatically JSON-serializes it
3. This converts `GaliCart` to the JSON string `"GaliCart"` (with surrounding quotes)
4. When retrieved from the database, the value contains the quotes: `"GaliCart"`
5. When displayed in the input field and saved again, it adds another layer of quotes

## Solution

### Backend Changes

Modified [settings.controller.ts](src/modules/admin/settings.controller.ts) to automatically detect and parse JSON-encoded strings in all three GET endpoints:

1. **`GET /settings`** - Public settings endpoint
2. **`GET /settings/admin/all`** - Admin settings with metadata
3. **`GET /settings/:key`** - Individual setting by key

Each endpoint now includes logic to:
- Check if the value is a string that starts and ends with quotes
- If yes, attempt to parse it using `JSON.parse()` to remove the extra quotes
- If parsing fails, return the original value unchanged

### Data Migration Script

Created [fix-quoted-settings.js](fix-quoted-settings.js) to clean up existing database records that already have double-quoted values.

**To run the migration:**
```powershell
cd d:\workdir\Copilot\GIT\workspace\marketplace-backend
node fix-quoted-settings.js
```

This script will:
- Scan all settings in the database
- Identify values that are wrapped in quotes
- Parse and update them to remove the extra quotes
- Report how many settings were fixed

## Testing

After applying the fix:

1. Run the migration script to clean existing data
2. Restart the backend server
3. Go to the admin settings page: `http://localhost:3000/admin/settings`
4. The marketplace name should display correctly as `GaliCart` (without quotes)
5. Change the name to something else and save
6. Verify it saves correctly without adding quotes
7. Reload the page and verify it displays correctly

## Files Modified

- `src/modules/admin/settings.controller.ts` - Added quote parsing logic to GET endpoints
- `fix-quoted-settings.js` - New migration script to fix existing data

## Prevention

The fix prevents future occurrences by:
- Automatically stripping extra quotes when retrieving settings from the database
- Not requiring any changes to how settings are saved
- Working transparently with the existing JSONB column type

## Notes

- The fix only affects string values that look like JSON strings (start and end with quotes)
- Complex objects, arrays, and properly formatted JSON remain unchanged
- The fix is backward compatible and won't break existing functionality
