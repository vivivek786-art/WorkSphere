# WorkSphere

WorkSphere loads projects, members, issue metadata, and issues from the Java API. Project/member/issue data and username/password accounts are stored in MySQL. Board, List, Backlog, and Timeline views share the same search and filters. Timeline dates are saved with each issue; due dates show overdue, due-today, and three-day warnings, while completed issues remain neutral.

## Run the API

Requirements: Java 8 or later, Maven, and MySQL running on `localhost:3306`.

Create the configured database before starting the API:

```sql
CREATE DATABASE `tracking_data`;
```

Set `SPRING_DATASOURCE_PASSWORD` in the environment where the API starts.

## Sign-in and first superadmin

WorkSphere uses app-managed username/password accounts. On the first startup, configure the bootstrap superadmin password in the same PowerShell terminal that starts the API:

```powershell
$env:WORKSPHERE_SUPERADMIN_PASSWORD = "<your-private-password-of-at-least-12-characters>"
mvn -f backend\pom.xml spring-boot:run
```

The initial username defaults to `vivek.kumar@tubelightcommunications.com`. To change it, set `WORKSPHERE_SUPERADMIN_USERNAME`; to change the displayed name, set `WORKSPHERE_SUPERADMIN_NAME`. Do not commit passwords or paste them into source files. The app creates the initial account only when the database has no enabled superadmin. Once created, the bootstrap password environment variable is not needed for later starts.

If you need to reset that superadmin password, stop the app and use a one-time reset in Command Prompt:

```cmd
set "WORKSPHERE_SUPERADMIN_PASSWORD=<your-new-private-password>"
set "WORKSPHERE_SUPERADMIN_RESET_PASSWORD=true"
mvn -f backend\pom.xml spring-boot:run
```

Replace the text inside the quotes with your own password; do not type the angle brackets.

After startup succeeds, stop the app, clear both variables in that terminal, and restart normally:

```cmd
set WORKSPHERE_SUPERADMIN_PASSWORD=
set WORKSPHERE_SUPERADMIN_RESET_PASSWORD=
mvn -f backend\pom.xml spring-boot:run
```

The reset targets the configured bootstrap username, restores it to enabled superadmin, and replaces its password. Use the reset flag only for this one startup.

Sign in at `http://localhost:8083/`. The superadmin can open **User management** to create, edit, disable, delete, and assign roles to accounts. Admins can manage regular user accounts; only superadmins can assign administrator roles. Passwords must be at least 12 characters. At least one enabled superadmin must remain, and an account cannot disable or delete itself.

Admins and superadmins can choose **Change profile photo** from their profile menu. PNG and JPEG images up to 2 MB and 2048 by 2048 pixels are supported.

The application is served at `http://localhost:8083/`; the API listens at `http://localhost:8083/common/api/v1`. Use HTTPS and secure deployment settings before exposing the app outside a trusted development environment.

## Workspaces

The app starts with a **Workspace** workspace. On the first startup after this update, existing projects and members are moved into it, and existing accounts are assigned access. Admins can use the workspace menu to create workspaces and manage which accounts belong to each one. Projects, issues, and workspace members are isolated between workspaces; account roles remain global.

## Workspace endpoints

- `GET /workspaces` — list workspaces available to the signed-in account
- `GET, POST /admin/workspaces` — list all workspaces or create one (admin/superadmin)
- `PUT /admin/workspaces/{workspaceId}/accounts` — update workspace name and account access (admin/superadmin)

Project, member, and issue endpoints, plus account creation, require the `X-Workspace-Id` header, using an ID returned by `GET /workspaces`.

## API endpoints

- `GET /metadata` — issue types, statuses, and priorities
- `GET, POST /projects` — list and create projects
- `GET, POST /members` — list and add workspace members
- `GET, POST /admin/accounts` — list and create user accounts (admin/superadmin)
- `PUT, DELETE /admin/accounts/{id}` — update or delete an account (admin/superadmin; superadmin role assignment is superadmin-only)
- `GET /projects/{projectId}/issues` — list project issues
- `POST /projects/{projectId}/issues` — create an issue
- `PUT, DELETE /projects/{projectId}/issues/{issueId}` — update or delete an issue

Issue writes use JSON properties `summary`, `description`, `type`, `status`, `priority`, nullable `assigneeId`, and optional ISO `startDate` / `dueDate` values (`yyyy-MM-dd`). In a new database, projects and members start empty; create them from the board UI.
