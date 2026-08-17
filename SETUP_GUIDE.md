# Church Membership and Subscription Management System - Setup Guide

## Quick Start

### 1. **First Time Setup - Create Demo Data**

1. Open the login page
2. Click the **"Setup Demo Data"** button at the bottom
3. Wait for it to complete (shows progress messages)
4. You'll see demo credentials appear

### 2. **Demo Credentials**

After setup, you can login with:

**Super Admin (Full System Access):**
- Email: `superadmin@church.com`
- Password: `Admin@1234`

**Church Admin (St. Mary's Church):**
- Email: `admin1@stmarys.com`
- Password: `Admin@1234`

**Church Admin (St. John's Church):**
- Email: `admin1@stjohns.com`
- Password: `Admin@1234`

---

## Features

### Super Admin Dashboard

**Access:** Full system-wide access to all churches and data

**Navigation Items:**
- **Dashboard** - Overview of all churches, members, and contributions
- **Members** - Search and manage members across all churches
- **Churches** - View all 6 church branches with statistics
- **Admin Users** - Create and manage super admins and church admins
- **Activity Logs** - Audit trail of all admin actions
- **Reports** - View and export contribution statistics

**Key Actions:**
- Add new Super Admin or Church Admin
- View all member data across churches
- Export member lists as CSV or PDF
- Track all activity across the system
- Generate financial reports

---

### Church Admin Dashboard

**Access:** Only data for their assigned church

**Navigation Items:**
- **Dashboard** - Church-specific statistics
- **Members** - Manage members for their church
- **Reports** - Contribution reports for their church

**Key Actions:**
- Add, edit, and delete members
- Record monthly contributions
- Search members by name or family number
- Export member lists as CSV or PDF
- View contribution trends

---

## How to Add Admins

### Option 1: Using the Admin Dashboard

1. **Login as Super Admin**
   - Email: `superadmin@church.com`
   - Password: `Admin@1234`

2. **Go to "Admin Users" page** (sidebar)

3. **Click "Add Admin" button**

4. **Fill in the form:**
   - **Full Name** - Admin's name
   - **Email** - Unique email for login
   - **Mobile** - Optional contact number
   - **Password** - Min 6 characters
   - **Role** - Choose:
     - **Super Admin** - Full system access
     - **Church Admin** - Access to only one church
   - **Church** - Required for Church Admins

5. **Click "Create Admin"**

The new admin can now login with their email and password.

---

## Member Management

### Add Members

1. Go to **Members** page
2. Click **"Add Member"** button
3. Fill in details:
   - Church (Super Admin only)
   - Family Number (e.g., FAM001)
   - Member Name
   - Address
   - Email
   - Mobile
4. Click **"Add Member"**

### Search Members

- Use the search bar at the top
- Search by: Member name, Family number, Email, Mobile

### View Member Details

- Click on any family group or member name
- See full member information
- View and edit monthly contributions
- Record contributions for all 11 funds

### Export Members

- Click **CSV** to download as Excel-compatible file
- Click **PDF** to print member list

### Manage Members

- Click checkbox to select members
- Use **Delete** button for bulk deletion
- Or click member to edit individually

---

## Recording Contributions

### Monthly Subscriptions

1. **Go to a member's detail page**
2. **Scroll to "Subscription / Contributions" section**
3. **Each row is a month**
4. **Columns for each fund:**
   - Sandha
   - Kattida Nidhi (Building Fund)
   - Aalaya Paraamarippu
   - Narseidhi Thiruppani
   - Yezhaiyar Nidhi
   - Pengal Thiruppani
   - Aangal Thiruppani
   - Ilainyar Thiruppani
   - Siruvar Thiruppani
   - Girama Nidhi
   - Kalvi Nidhi

5. **Click any cell to edit**
6. **Type the amount**
7. **Click "Save Changes"**

### Summary Information

- **Total Building Fund (Kattida Nidhi)** - Total for the year
- **Grand Total** - All contributions combined

---

## Reports

### View Reports

1. Go to **Reports** page
2. Navigate between years using arrow buttons
3. See monthly breakdown table
4. View contribution chart

### Export Reports

- Click **"Export CSV"** to download spreadsheet
- Data includes all funds and monthly totals

### Summary Data

- **Grand Total** - All contributions for the year
- **Building Fund** - Kattida Nidhi total
- **Active Months** - Months with recorded contributions

---

## Activity Logs (Super Admin Only)

### View All Activity

1. Go to **Activity Logs** page (Super Admin only)
2. See audit trail of all admin actions:
   - Member creation, updates, deletions
   - Admin account changes
   - Data modifications

### Filter by Action

- **All** - All activities
- **Create** - New records created
- **Update** - Records modified
- **Delete** - Records removed

### Information Shown

- Date and time of action
- Admin who performed action
- Church affected
- Type of action
- Description of changes

---

## Login Issues & Troubleshooting

### Can't Login?

1. **Check your credentials:**
   - Use demo credentials if first time
   - Verify email or mobile number is correct
   - Password is case-sensitive

2. **Try email instead of mobile:**
   - System supports both but may have issues
   - Use email if mobile doesn't work

3. **Reset from Setup:**
   - Click "Setup Demo Data" again
   - This recreates accounts if they don't exist

### Can't See "Setup Demo Data"?

- Churches must be loaded first
- Refresh the page and try again
- Check browser console for errors

### Demo Setup Failed?

1. Check Supabase connection (ask administrator)
2. Ensure 6 churches exist in database
3. Try again - may be temporary issue
4. Contact administrator if persists

---

## Database Structure

### Churches Table
- 6 pre-configured church branches
- Each with unique name and location

### Members
- Organized by family numbers
- Can be filtered by church
- Full contact information stored

### Subscriptions
- Monthly contribution records
- 11 different fund types
- Year-wise tracking

### Activity Logs
- All admin actions tracked
- Timestamp and user information
- Changes recorded for audit

### Profiles
- Admin user accounts
- Role-based permissions
- Church assignment for church admins

---

## Security Notes

- **RLS Enabled:** Supabase Row Level Security restricts data access
- **Super Admins:** Can access all churches
- **Church Admins:** Can only access their assigned church
- **Data Encryption:** All data encrypted in Supabase
- **Audit Trail:** All actions logged for compliance

---

## Common Tasks

### Create Super Admin
1. Login as Super Admin
2. Admin Users → Add Admin
3. Select "Super Admin" role
4. No church assignment needed

### Assign Admin to Church
1. Login as Super Admin
2. Admin Users → Add Admin
3. Select "Church Admin" role
4. Choose specific church from dropdown
5. Create account

### Add Member Family
1. Members page
2. Click "Add Member"
3. Enter same Family Number for all family members
4. System groups them automatically

### View Church Statistics
1. Go to Dashboard
2. See member count per church
3. Go to Churches page for details
4. Click Refresh to update

### Export Full Member List
1. Members page
2. Use CSV or PDF buttons
3. File downloads with timestamp

### Track Contribution Changes
1. Member detail page
2. Edit contribution amounts
3. Save changes
4. Check Activity Logs for audit trail

---

## Support

For issues or questions:
1. Check this guide
2. Review Activity Logs for what went wrong
3. Contact your Super Admin
4. Check browser console for error messages

---

## Demo Data Included

When you run "Setup Demo Data", you get:

- **4 Admin Accounts** (1 super, 3 church)
- **8 Members** (4 families in St. Mary's Church)
- **6 Months of Contributions** for each member
- **Varied contribution amounts** for realism

All demo data is editable and deletable.

---

## Tips & Best Practices

1. **Always use descriptive Family Numbers** - Makes searching easier
2. **Keep contact info updated** - For emergency communication
3. **Record contributions monthly** - Don't wait, easier to remember amounts
4. **Check Activity Logs regularly** - Monitor what's happening in the system
5. **Export reports periodically** - For records and backup
6. **Use proper role assignment** - Security best practice

---

**Version:** 1.0
**Last Updated:** 2026-04-14
**System:** Church Membership & Subscription Management
