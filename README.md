<div align="center">

<i>Personal finance intelligence + internal company dashboard.</i>

<br/>


<img alt="Chuchube Finance Banner" src="https://readme-typing-svg.demolab.com?font=Inter&weight=800&size=36&duration=2500&pause=800&color=FFFFFF&center=true&vCenter=true&width=920&lines=Chuchube+Finance;AI-powered+personal+finance+%2B+company+view" />

<br/><br/>


<img alt="Terraform" src="https://img.shields.io/badge/Terraform-111827?logo=terraform&logoColor=7B42BC" />
<img alt="AWS" src="https://img.shields.io/badge/AWS-111827?logo=amazonaws&logoColor=FF9900" />
<img alt="ECR" src="https://img.shields.io/badge/Amazon%20ECR-111827?logo=amazonaws&logoColor=FF9900" />
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-111827?logo=typescript&logoColor=3178C6" />
<img alt="Node.js" src="https://img.shields.io/badge/Node.js-111827?logo=node.js&logoColor=339933" />
<img alt="Python" src="https://img.shields.io/badge/Python-111827?logo=python&logoColor=3776AB" />
<img alt="Streamlit" src="https://img.shields.io/badge/Streamlit-111827?logo=streamlit&logoColor=FF4B4B" />
<img alt="Supabase" src="https://img.shields.io/badge/Supabase-111827?logo=supabase&logoColor=3ECF8E" />
<img alt="Google Gemini" src="https://img.shields.io/badge/Gemini-111827?logo=google&logoColor=ffffff" />
<img alt="license" src="https://img.shields.io/badge/license-MIT-2ea44f" />
<img alt="iac" src="https://img.shields.io/badge/IaC-Terraform-7B42BC" />
<img alt="aws" src="https://img.shields.io/badge/cloud-AWS-FF9900" />
<img alt="ecr" src="https://img.shields.io/badge/registry-ECR-FF9900" />
<img alt="deploy" src="https://img.shields.io/badge/deploy-Infra%20Automation-111827" />


<br/><br/>

</div>


# FinCore Financial Platform Monorepo

This repository contains the source code for **FinCore** , a high-performance financial services platform managed as a **Monorepo** using **npm workspaces** . It houses the secure customer dashboard, ledger services, authentication systems, and banking standards libraries in a single repository to ensure type safety, atomic updates, and strict compliance.

## 🏗 Architecture

- **Package Manager:** npm (v7+) with Workspaces
- **Language:** TypeScript (Strict Mode)
- **Frontend:** Next.js / React (`apps/web-client`) - _Customer Dashboard_
- **Backend:** Node.js / Express & Firebase Cloud Functions (`apps/auth-service`, `apps/backend`)
- **Database:** PostgreSQL (via Prisma) for Ledger & Firestore for Real-time events
- **Infrastructure:** Vercel (Frontend), Railway/GCP (Backend Services)

## 📂 Project Structure

**Plaintext**

```
/fincore-monorepo
├── package.json             # Root workspace manager & Shortcut Scripts
├── firebase.json            # Firebase configuration (Root level)
├── apps/
│   ├── web-client/          # Secure Customer Dashboard (Next.js)
│   ├── auth-service/        # Identity & Access Management (IAM/OAuth)
│   ├── transaction-service/ # Ledger & Payment Processing API
│   └── backend/             # Async Jobs (Fraud Detection/Notifications)
└── packages/
    ├── ui-kit/              # Shared Financial Components (Data Grids, Charts)
    ├── shared-types/        # DTOs & Interfaces (User, Transaction, Wallet)
    └── database/            # Prisma Schema & DB Client (ACID Compliant)
```

## Getting Started

### Prerequisites

- Node.js (LTS version recommended, e.g., v20+)
- npm (v7 or higher)

### Installation

From the root directory, install all dependencies for all services and libraries:

**Bash**

```
npm install
```

_Note: This automatically links internal packages (like `@fincore/types`) using symlinks, ensuring the Transaction Service and Web Client share the exact same data models._

### Running Development Servers

We have configured shortcuts in the root `package.json` for common tasks.

**To run the Customer Dashboard (Frontend):**

**Bash**

**Bash**

```
npm run dev:web
# Equivalent to: npm run dev -w apps/web-client
```

**To run the Auth/Identity Service:**

**Bash**

**Bash**

```
npm run dev -w apps/auth-service
```

**To run Background Jobs (Fraud/Cloud Functions):**

**Bash**

**Bash**

```
# Build the backend first to compile TypeScript
npm run build -w apps/backend
firebase emulators:start
```

---

## 🛠 Development Cheatsheet

**Note:** Always run these commands from the **Root** directory to maintain the workspace context.

### Shortcut Scripts (Web Client)

These scripts are defined in the root `package.json` for convenience.

| **Action**           | **Shortcut Command** | **Full Command**                   |
| -------------------- | -------------------- | ---------------------------------- |
| **Start Dev Server** | `npm run dev:web`    | `npm run dev -w apps/web-client`   |
| **Build**            | `npm run build:web`  | `npm run build -w apps/web-client` |
| **Start Production** | `npm run start:web`  | `npm run start -w apps/web-client` |
| **Lint Code**        | `npm run lint:web`   | `npm run lint -w apps/web-client`  |

### Managing Dependencies

| **Goal**                      | **Command**                                        |
| ----------------------------- | -------------------------------------------------- |
| **Install External Package**  | `npm i <package_name> -w apps/<app_name>`          |
| **Example (Chart Lib)**       | `npm i recharts -w apps/web-client`                |
| **Install Internal Lib**      | `npm i @fincore/types -w apps/transaction-service` |
| **Install Dev Tool (Global)** | `npm i -D prettier`(Installs at root)              |
| **Remove Package**            | `npm uninstall <package_name> -w apps/<app_name>`  |

### Dependency Conflict Procedures

Use these steps when you see type mismatches or duplicate dependency versions across workspaces.

1. **Identify duplicates**: Check if multiple versions of a dependency are installed across the workspace (e.g., in the lockfile or dependency tree).
2. **Pick a single version**: Decide the version to standardize on (prefer the newest version that all consumers support).
3. **Pin at the root**: Add an `overrides` entry in the root `package.json` to force a single version.
4. **Align workspace deps**: Update any workspace `package.json` files to match the pinned version range.
5. **Clean install**: Remove `node_modules` and reinstall from the workspace root to regenerate a clean lockfile.
6. **Verify**: Recheck the dependency tree to confirm only one version is present.
7. **Rebuild**: Run the production build to ensure type checks pass.

### Creating & Testing

| **Goal**               | **Command**                                |
| ---------------------- | ------------------------------------------ |
| **Create New Service** | `npm init -w ./apps/analytics-service -y`  |
| **Create New Lib**     | `npm init -w ./packages/bank-standards -y` |
| **Run Tests (All)**    | `npm run test --workspaces`                |
| **Run Tests (One)**    | `npm run test -w apps/transaction-service` |

### 🎨 UI Components (shadcn/ui)

We install **shadcn/ui** components directly into `apps/web-client` to build secure, accessible financial forms.

**To add a new component (e.g., Data Table or Input):**

1. **Navigate to the app:**
   **Bash**

   ```
   cd apps/web-client
   ```

2. **Run the add command:**
   **Bash**

   ```
   npx shadcn@latest add table
   ```

3. **Cleanup (Crucial):** The CLI might create a nested `package-lock.json`. Delete it and sync from root to keep the monorepo healthy.
   **Bash**

   ```
   rm package-lock.json
   cd ../..
   npm install
   ```

### 🆘 Troubleshooting (The "Nuke" Command)

If dependencies get out of sync or TypeScript throws phantom errors regarding shared types:

**Bash**

**Bash**

```
rm -rf node_modules && npm install
```

---

## 📦 Deployment

This repo uses a **Split Stack** deployment strategy to optimize for security and speed.

1. **Frontend (`apps/web-client`):** Deploys to **Vercel** (Edge Network).
   - _Root Directory setting in Vercel:_ `apps/web-client`

2. **Backend Services (`apps/llm`:** Deploys to **Railway** (Private Network).
   - _Root Directory setting in Railway:_ `.` (Root)
   - _Start Command:_ `npm start -w apps/auth-service`

---

## 🧹 Maintenance

### How to Remove an App Safely

If you need to decommission a service (e.g., `apps/legacy-service`):

1. Delete the folder:
   Bash
   **Bash**

   ```
   rm -rf apps/legacy-service
   ```

2. Update npm references:
   Bash
   **Bash**

   ```
   npm install
   ```

3. Clean up consumers:
   Check if web-client or other apps listed it in their package.json and remove it:
   Bash
   **Bash**

   ```
   npm uninstall @fincore/legacy-service -w apps/web-client
   ```

---

## 📝 Version Control (Git)

We do **not** use submodules. Everything is tracked in one `.git` folder.

### 1. Development & Git Workflow

To ensure our history remains clean and to avoid "divergent branch" errors, please follow this workflow for all contributions.

### 1. Start with a Fresh State

Before starting any work, switch to the main development branch and make sure you have the latest changes.

```bash
git checkout develop
git pull --rebase origin develop
```

### 2. Create a Feature Branch

**Never** commit directly to `develop`. Create a specific branch for your task.
_Naming convention:_ `feature/name-of-feature` or `fix/issue-being-fixed`

**Bash**

```
git checkout -b feature/my-new-feature
```

### 3. Do Your Work

Make your changes and commit them.

**Bash**

```
git add .
git commit -m "feat: add new login component"
```

### 4. Sync with Remote (If needed)

If you've been working for a while, `develop` might have moved ahead. Pull the latest changes into your branch to check for conflicts.

**Bash**

```
# Fetch the latest develop
git fetch origin develop

# Rebase your branch on top of it (keeps history clean)
git rebase origin/develop
```

_If there are conflicts, resolve them, `git add .`, and then `git rebase --continue`._

### 5. Push and Open a Pull Request

Push your feature branch to the server.

**Bash**

```
git push -u origin feature/my-new-feature
```

Go to GitHub and open a **Pull Request (PR)** targeting `develop`. Once approved, squash and merge via the GitHub UI.

**Atomic Commits (Recommended):**

When updating a shared library (e.g., changing the `Transaction` interface) and the app that uses it, commit them together to prevent breaking the build.

**Bash**

**Bash**

```
git add packages/shared-types apps/transaction-service
git commit -m "feat(ledger): updated transaction schema for ISO 20022 compliance"
git push origin main
```

**Ignoring Secrets:**

- Global secrets (like `.env`) are ignored by the root `.gitignore`.
- App-specific secrets (like `service-account.json`, `private-keys.pem`) should be added to the root `.gitignore` as `apps/service-name/secret.json`.
