# Exam Claim Manager

An electron-based application for managing exam claims, practicals, project viva-voce, and other examination remuneration.

## Project info

This project is built to handle Anna University remuneration guidelines automatically, generate claim PDFs, calculate allowances, and export tabular reports to Excel.

## How to run locally

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Install the necessary dependencies.
npm i

# Step 2: Start the development server with auto-reloading and an instant preview.
npm run dev
```

To build for production as an Electron app:

```sh
npm run electron
```

## What technologies are used for this project?

This project is built with:

- Electron
- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- jsPDF
- SheetJS (xlsx)
- Supabase
