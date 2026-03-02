# Welcome to your Lovable project

## Project info

**URL**: https://lovable.dev/projects/b60248d9-1774-4aea-8076-571956fd963a

## How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/b60248d9-1774-4aea-8076-571956fd963a) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/b60248d9-1774-4aea-8076-571956fd963a) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)

## How to extract sections to individual HTML files

The `sections/` folder contains individual HTML files for each section in the application. These can be extracted automatically from the main `index.html` using a Puppeteer-based extraction script.

### Prerequisites

Make sure you have the required dependencies installed:

```sh
npm install puppeteer
```

### Extracting Sections

Run the section extraction script:

```sh
node extract-sections.cjs
```

### What it does

The script will:

1. Launch a headless browser (Puppeteer)
2. Load the `index.html` file from the project root
3. Wait for the app to render completely
4. Extract all `<section>` elements from the `#app` container
5. Save each section as a separate HTML file in the `sections/` directory
6. Create a `README.md` index file listing all extracted sections

### Output

- **Individual section files**: `fp-theme-hero.html`, `fp-theme-pricing.html`, etc.
- **Index file**: `sections/README.md` - Lists all extracted sections with their IDs

Each section file contains the complete HTML markup for that section, making it easy to:
- Reuse sections across different pages
- Test sections individually
- Create templates from existing designs

## How to generate screenshots for sections

The `screenshots/` folder contains preview images of all the sections in the application. These are generated automatically using a Puppeteer-based screenshot generator.

### Prerequisites

Make sure you have the required dependencies installed:

```sh
npm install puppeteer sharp
```

You also need a local PHP server running (e.g., MAMP, XAMPP, or PHP's built-in server) with the project accessible at:
```
http://localhost/nine-screen-canvas-flow/
```

### Generating Screenshots

Run the screenshot generator script:

```sh
node screenshot-generator.cjs
```

### What it does

The script will:

1. Launch a headless browser (Puppeteer)
2. Load the `index.html` page from your local server
3. Scroll through the entire page, capturing viewport screenshots at each position
4. Take a full-page screenshot of the entire layout
5. Compress all images to max 700px width and convert to JPG format
6. Save all screenshots to the `screenshots/` directory

### Output

- **Individual screenshots**: `1.jpg`, `2.jpg`, `3.jpg`, etc. (viewport-by-viewport captures)
- **Full page**: `full-page.jpg` (entire page in one image)

All images are automatically compressed for optimal file size while maintaining quality (85% JPEG quality).

