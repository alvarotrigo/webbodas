# RSVP Dashboard — Setup & Testing Guide

This document explains how to configure the database and test the end-to-end RSVP flow (form submission → dashboard).

---

## Overview

When a user publishes a wedding website that contains a `<form>`, guests can fill in the RSVP form on the live site and the responses are saved to the database. The website owner can then review, edit, and export all responses from a private dashboard.

```
Guest fills form on published site
        ↓
api/form-submit.php  (no auth required)
        ↓
form_submissions table (MySQL)
        ↓
Owner views dashboard at /rsvp?page=PAGE_ID  (auth required)
```

---

## 1. Database migration

### Requirements
- MySQL 5.7+ or MariaDB 10.3+
- The `user_pages` and `users` tables must already exist (run `config/mysql-schema.sql` first if starting from scratch)

### Run the migration

Using the MySQL CLI (replace `fpstudio` with the value of `DB_LOCAL_NAME` in your `.env`):

```bash
mysql -u root fpstudio < migrations/create_form_submissions.sql
```

Or paste the file contents directly into **HeidiSQL**, **phpMyAdmin**, or **Laragon's MySQL shell**.

### What the migration creates

| Object | Purpose |
|--------|---------|
| `form_submissions` table | Stores every RSVP response as a JSON blob, plus `table_number` and `group_id` columns |
| `dashboard_access_links` table | Private shareable links for collaborators (e.g. the couple's partner) |
| `guest_groups` table | Custom group labels per page (e.g. "Bride's Family", "Work Friends") with a display color |
| `user_pages.form_open` column | Boolean — whether the form is still accepting responses (default `TRUE`) |
| `user_pages.form_closed_message` | Message shown to guests when the form is closed |
| `form_submissions.table_number` | Text field for table assignment (seating plan) |
| `form_submissions.group_id` | FK to `guest_groups` — assigns the guest to a group |

> **Note:** If you re-run the migration on an existing database, MySQL will throw "Duplicate column name" for any `ALTER TABLE` statements where the columns already exist. This is safe to ignore.

---

## 2. Publish a page with a form

The RSVP dashboard only works for pages that are **published** and have an RSVP `<form>` in their HTML (all wedding templates include one).

1. Open the editor at `/app` (or `/app.php`).
2. Select or create a page using any wedding template (template1–template6 all have RSVP sections).
3. Make any edits you want.
4. Click **Publish** in the top bar, enter a website name (e.g. `mi-boda`), and confirm.

The page is now live at `https://mi-boda.yeslovey.com` (or `shared.html?slug=mi-boda` locally).

---

## 3. Access the RSVP Dashboard

### From the editor

Once the page is published, a small **RSVP** button appears in the editor top bar (next to the Publish button). Click it to open the dashboard for the current page.

### From the pages list

In `pages.php` (the "My Pages" screen), open the three-dot menu on any published page that has a form and click **RSVP Dashboard**.

### Direct URL

```
/rsvp?page=PAGE_ID
```

Replace `PAGE_ID` with the UUID of the page (visible in the editor URL: `/app?page=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX`).

You must be **logged in** (Clerk session active). If not, you are redirected to the sign-in page.

---

## 4. Test the full flow locally

### Step 1 — Open the published page as a guest

Open a new browser tab or an incognito window and navigate to the published page:

```
http://your-local-domain/shared.html?slug=mi-boda
```

(With Laragon the domain is usually something like `http://nine-screen-canvas-flow.test`.)

### Step 2 — Submit the RSVP form

Fill in the form fields (name, email, attendance, etc.) and click the submit button. You should see a toast notification: **"Thank you! Your RSVP has been received."**

If instead you see an error, open the browser console (F12) and check the network request to `api/form-submit.php` for details.

### Step 3 — View the response in the dashboard

Go back to your logged-in browser and open the dashboard:

```
http://your-local-domain/rsvp?page=PAGE_ID
```

The response should appear as a row in the table. The stats at the top (Responses, Attending, Declining, Total guests) update automatically.

---

## 5. Dashboard features

| Feature | How to use |
|---------|-----------|
| **View responses** | Table with one row per submission; columns are dynamic based on the form fields |
| **Edit a cell** | Click any value in the table to edit it inline; press Enter or click away to save |
| **Table number** | Click the **Table** cell on any row and type a table number (e.g. `5` or `A3`). Used for seating plans. Included in the CSV export. |
| **Guest groups** | Click **Groups** in the top bar to create custom labels (e.g. "Bride's Family", "University Friends", "Work"). Each group gets a color. Assign a group to each guest via the **Group** dropdown in the table. |
| **Filter by group** | Once groups exist, colored filter pills appear below the search box. Click a pill to show only that group's guests; click **All** to reset. |
| **Add/edit notes** | Click the "Add note…" cell in the Notes column; a textarea appears |
| **Delete a response** | Click the trash icon on the right of any row |
| **Search** | Type in the search box to filter rows by any field, note, or table number |
| **Toggle form open/close** | Click **Toggle form** in the top bar; guests will see a custom message when the form is closed |
| **Share access** | Click **Share access** to generate a private link for your partner (no Clerk account needed) |
| **Export CSV** | Click **Export CSV** to download all responses as a `.csv` file. Includes **Table Number** and **Group** columns, compatible with Excel and Google Sheets. |
| **Modo Boda** | Use the user menu (top right) to switch to the warm wedding colour theme |

---

## 6. Guest groups in detail

Guest groups are labels you create to organize the guest list by origin or relationship (e.g. "Bride's Family", "Groom's Friends", "Work Colleagues", "University").

### Creating a group

1. Click **Groups** in the dashboard top bar.
2. In the modal, type a name in the "New group name" field.
3. Select a color from the swatch palette.
4. Click **Add group**.

Groups are stored per page — each wedding website has its own independent set of groups.

### Assigning guests

In the **Group** column of the response table, each row has a dropdown. Select a group from the list; the assignment is saved automatically. The dropdown border changes color to match the assigned group.

### Filtering by group

Once at least one group exists, a row of colored pills appears between the search box and the response count. Click any pill to filter the table to that group only. Click **All** to clear the filter.

> Deleting a group unassigns all guests who belonged to it — no data is lost, only the label is removed.

---

## 7. Table numbers & seating plan

The **Table** column lets you assign a table number (or label like "A1") to each guest directly from the dashboard. Click any cell in the Table column to edit it inline.

Table numbers are stored as plain text so you can use numbers (`5`), alphanumeric codes (`Table B`), or any other format.

The **Export CSV** includes a "Table Number" column, making it easy to import the data into a seating plan tool or sort guests by table in Excel / Google Sheets.

---

## 8. Troubleshooting

### "Page not found or not public" on form submit
The page must have `is_public = 1` in the database. This is set automatically when you publish via the editor. If you see this error, re-publish the page.

### Columns named "TINYMCE …" appear in the dashboard
This happens when old submissions were captured before the TinyMCE filter was applied. Delete those rows from the database and submit a fresh test response:

```sql
DELETE FROM form_submissions WHERE page_id = 'YOUR_PAGE_ID';
```

All new submissions automatically strip TinyMCE internal fields.

### 404 on `/rsvp`
Check that:
- `.htaccess` has `mod_rewrite` enabled in Laragon (Apache → `mod_rewrite` module is on).
- The `.htaccess` rule for `/rsvp` is present (it was added to the file automatically).

### "Authentication required" from the API
You must have an active Clerk session in the same browser. Log in at `/signin` first.

### The RSVP button does not appear in the editor
The button only shows when the current page is already published (`share_slug` is set). Publish the page first. If it still doesn't appear after publishing, refresh the editor page.

### Group or table number not saving
Check the browser console for errors on the `PUT api/submissions.php` request. Verify the migration has been run and the `table_number` / `group_id` / `guest_groups` columns and table exist.

---

## 9. Files reference

| File | Purpose |
|------|---------|
| `migrations/create_form_submissions.sql` | Complete database migration — run this once to set up all RSVP tables and columns |
| `migrations/add_table_number_and_groups.sql` | Legacy standalone migration (now consolidated into the file above; kept for reference) |
| `api/form-submit.php` | Public endpoint that saves RSVP responses from guests |
| `api/submissions.php` | Private API: list, update, delete, toggle, share, export, and guest group CRUD |
| `rsvp.php` | Dashboard page (PHP + HTML) |
| `public/css/rsvp.css` | Dashboard styles |
| `public/js/rsvp.js` | Dashboard JavaScript |
| `shared.html` | Published site renderer — intercepts form submits |
| `api/get.php` | Returns `form_open` state alongside page data |
