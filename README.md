# MarketPlace

## Getting started

To make it easy for you to get started with GitLab, here's a list of recommended next steps.

Already a pro? Just edit this README.md and make it your own. Want to make it easy? [Use the template at the bottom](#editing-this-readme)!

## Add your files

- [ ] [Create](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#create-a-file) or [upload](https://docs.gitlab.com/ee/user/project/repository/web_editor.html#upload-a-file) files
- [ ] [Add files using the command line](https://docs.gitlab.com/topics/git/add_files/#add-files-to-a-git-repository) or push an existing Git repository with the following command:

```
cd existing_repo
git remote add origin https://gitlab.com/anubhav.s.joshi/marketplace.git
git branch -M main
git push -uf origin main
```

## Integrate with your tools

- [ ] [Set up project integrations](https://gitlab.com/anubhav.s.joshi/marketplace/-/settings/integrations)

## Collaborate with your team

- [ ] [Invite team members and collaborators](https://docs.gitlab.com/ee/user/project/members/)
- [ ] [Create a new merge request](https://docs.gitlab.com/ee/user/project/merge_requests/creating_merge_requests.html)
- [ ] [Automatically close issues from merge requests](https://docs.gitlab.com/ee/user/project/issues/managing_issues.html#closing-issues-automatically)
- [ ] [Enable merge request approvals](https://docs.gitlab.com/ee/user/project/merge_requests/approvals/)
- [ ] [Set auto-merge](https://docs.gitlab.com/user/project/merge_requests/auto_merge/)

## Test and Deploy

Use the built-in continuous integration in GitLab.

- [ ] [Get started with GitLab CI/CD](https://docs.gitlab.com/ee/ci/quick_start/)
- [ ] [Analyze your code for known vulnerabilities with Static Application Security Testing (SAST)](https://docs.gitlab.com/ee/user/application_security/sast/)
- [ ] [Deploy to Kubernetes, Amazon EC2, or Amazon ECS using Auto Deploy](https://docs.gitlab.com/ee/topics/autodevops/requirements.html)
- [ ] [Use pull-based deployments for improved Kubernetes management](https://docs.gitlab.com/ee/user/clusters/agent/)
- [ ] [Set up protected environments](https://docs.gitlab.com/ee/ci/environments/protected_environments.html)

***

# Marketplace - Full-Stack E-Commerce Platform

A modern multi-vendor marketplace built with Next.js, NestJS, and React Native.

## 🏗️ Project Structure

```
marketplace/
├── apps/
│   ├── backend/     # NestJS API server (Port 3001)
│   ├── web/         # Next.js web application (Port 3000)
│   └── mobile/      # React Native mobile app
├── docs/           # Documentation
└── scripts/        # PowerShell automation scripts
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- Google OAuth credentials (optional, for social login)

### 1. Install All Dependencies
```powershell
.\install-all.ps1
```

### 2. Setup Environment Variables

**Backend** (`apps/backend/.env`):
```env
DATABASE_URL="postgresql://user:password@localhost:5432/marketplace"
JWT_SECRET="your-super-secret-jwt-key"
PORT=3001
```

**Web** (`apps/web/.env.local`):
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

### 3. Setup Database
```powershell
cd apps/backend
npx prisma migrate dev
npx prisma generate
cd ../..
```

### 4. Start All Services
```powershell
.\start-dev.ps1
```

This will start:
- **Backend API**: http://localhost:3001
- **Web App**: http://localhost:3000
- **API Docs**: http://localhost:3001/api

To stop all services:
```powershell
.\stop-all.ps1
```

## 🎨 Features

- ✅ User Authentication (Email/Password + Google OAuth)
- ✅ Login & Sign Up Pages
- ✅ Modern UI with Tailwind CSS & Dark Mode
- ✅ RESTful API with Swagger documentation
- ✅ TypeScript throughout
- ✅ Secure JWT authentication

## 🛠️ Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- TanStack Query
- Zustand

**Backend:**
- NestJS
- TypeScript
- TypeORM
- PostgreSQL
- Passport.js + JWT

**Mobile:**
- React Native
- Expo Router

## 📝 Development Scripts

### PowerShell Scripts
- `.\install-all.ps1` - Install all dependencies
- `.\start-dev.ps1` - Start backend and web in development mode
- `.\stop-all.ps1` - Stop all running services

### Manual Commands

**Backend:**
```powershell
cd apps/backend
npm run start:dev    # Development
npm run build        # Build
npm run start:prod   # Production
```

**Web:**
```powershell
cd apps/web
npm run dev          # Development
npm run build        # Build
npm run start        # Production
```

## 🔐 Authentication Flow

1. User accesses `/login` page
2. Chooses Email/Password OR Google OAuth
3. **Google Flow:**
   - Redirects to Google → User authorizes
   - Google returns code → Frontend exchanges for user info
   - Backend creates/logs in user → Returns JWT token
4. Token stored in secure cookie
5. User redirected to homepage

## 📚 API Documentation

Visit http://localhost:3001/api for interactive Swagger documentation.

## 🗄️ Database

The app uses PostgreSQL with Prisma ORM. See `docs/database.md` for schema details.

## 📖 Additional Documentation

- [API Documentation](docs/api.md)
- [Database Schema](docs/database.md)
- [Deployment Guide](docs/deployment.md)
- [Getting Started](docs/getting-started.md)

## Editing this README

## Suggestions for a good README

Every project is different, so consider which of these sections apply to yours. The sections used in the template are suggestions for most open source projects. Also keep in mind that while a README can be too long and detailed, too long is better than too short. If you think your README is too long, consider utilizing another form of documentation rather than cutting out information.

## Name
Choose a self-explaining name for your project.

## Description
Let people know what your project can do specifically. Provide context and add a link to any reference visitors might be unfamiliar with. A list of Features or a Background subsection can also be added here. If there are alternatives to your project, this is a good place to list differentiating factors.

## Badges
On some READMEs, you may see small images that convey metadata, such as whether or not all the tests are passing for the project. You can use Shields to add some to your README. Many services also have instructions for adding a badge.

## Visuals
Depending on what you are making, it can be a good idea to include screenshots or even a video (you'll frequently see GIFs rather than actual videos). Tools like ttygif can help, but check out Asciinema for a more sophisticated method.

## Installation
Within a particular ecosystem, there may be a common way of installing things, such as using Yarn, NuGet, or Homebrew. However, consider the possibility that whoever is reading your README is a novice and would like more guidance. Listing specific steps helps remove ambiguity and gets people to using your project as quickly as possible. If it only runs in a specific context like a particular programming language version or operating system or has dependencies that have to be installed manually, also add a Requirements subsection.

## Usage
Use examples liberally, and show the expected output if you can. It's helpful to have inline the smallest example of usage that you can demonstrate, while providing links to more sophisticated examples if they are too long to reasonably include in the README.

## Support
Tell people where they can go to for help. It can be any combination of an issue tracker, a chat room, an email address, etc.

## Roadmap
If you have ideas for releases in the future, it is a good idea to list them in the README.

## Contributing
State if you are open to contributions and what your requirements are for accepting them.

For people who want to make changes to your project, it's helpful to have some documentation on how to get started. Perhaps there is a script that they should run or some environment variables that they need to set. Make these steps explicit. These instructions could also be useful to your future self.

You can also document commands to lint the code or run tests. These steps help to ensure high code quality and reduce the likelihood that the changes inadvertently break something. Having instructions for running tests is especially helpful if it requires external setup, such as starting a Selenium server for testing in a browser.

## Authors and acknowledgment
Show your appreciation to those who have contributed to the project.

## License
For open source projects, say how it is licensed.

## Project status
If you have run out of energy or time for your project, put a note at the top of the README saying that development has slowed down or stopped completely. Someone may choose to fork your project or volunteer to step in as a maintainer or owner, allowing your project to keep going. You can also make an explicit request for maintainers.
