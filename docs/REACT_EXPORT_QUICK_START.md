# React Export - Quick Start Guide

## 🚀 Getting Started with React Export

### Step 1: Export Your Project

1. Click the **Download** button in the editor toolbar
2. Select **"React + Vite"** from the export options
3. Wait for the download to complete (usually takes a few seconds)

### Step 2: Extract and Setup

```bash
# Extract the ZIP file
unzip fpstudio-react-app.zip

# Navigate to the project
cd fpstudio-react-app

# Install dependencies
npm install
```

### Step 3: Run Your Project

```bash
# Start the development server
npm run dev
```

Your site will be available at **http://localhost:8000** 🎉

## 📦 What's Included

Your exported project includes:

✅ **Complete React setup** - React 19 with latest features  
✅ **Vite dev server** - Lightning-fast HMR and builds  
✅ **Tailwind CSS 4** - All your styles preserved  
✅ **React Router** - Ready for multi-page apps  
✅ **ESLint** - Code quality checks  
✅ **Component files** - Each section as a separate component  

## 🎯 Project Structure

```
fpstudio-react-app/
├── src/
│   ├── components/        # 👈 Your sections here
│   │   ├── HeroSection.jsx
│   │   ├── FeaturesSection.jsx
│   │   └── ...
│   ├── pages/
│   │   └── index.jsx     # 👈 Main page
│   ├── main.jsx          # 👈 App entry point
│   └── index.css         # 👈 Global styles
└── ...config files
```

## 🛠 Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Check code quality |

## 🎨 Customizing Components

Each section is a standalone React component:

```jsx
// src/components/HeroSection.jsx
import React from "react";

const HeroSection = () => {
  return (
    <section className="...">
      {/* Your section content */}
    </section>
  );
};

export default HeroSection;
```

### Editing a Component

1. Open the component file in `src/components/`
2. Modify the JSX or add new functionality
3. Save the file - changes appear instantly!

### Adding Interactivity

```jsx
import React, { useState } from "react";

const ContactSection = () => {
  const [email, setEmail] = useState('');
  
  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Email:', email);
    // Add your logic here
  };
  
  return (
    <section>
      <form onSubmit={handleSubmit}>
        <input 
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit">Submit</button>
      </form>
    </section>
  );
};

export default ContactSection;
```

## 🔧 Common Customizations

### Change Component Order

Edit `src/pages/index.jsx`:

```jsx
function Index() {
  return (
    <>
      <HeroSection />
      <FeaturesSection />
      <TestimonialsSection />  {/* Change order here */}
    </>
  );
}
```

### Add New Pages

Create a new file in `src/pages/`:

```jsx
// src/pages/about.jsx
import React from "react";

function About() {
  return <div>About Page</div>;
}

export default About;
```

Access it at: `http://localhost:8000/about`

### Reuse Components

```jsx
// Use the same component multiple times
<HeroSection />
<FeaturesSection />
<HeroSection /> {/* Reused! */}
```

### Add Props to Components

```jsx
// Modify component to accept props
const HeroSection = ({ title, subtitle }) => {
  return (
    <section>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </section>
  );
};

// Use with props in index.jsx
<HeroSection 
  title="Welcome" 
  subtitle="Get started today"
/>
```

## 🌐 Building for Production

When you're ready to deploy:

```bash
# Create production build
npm run build

# Preview the build locally
npm run preview
```

The build output will be in the `dist/` folder - ready to deploy to any static host!

## 📤 Deployment Options

Your React project can be deployed to:

- **Vercel** - `vercel deploy`
- **Netlify** - Drag & drop the `dist` folder
- **GitHub Pages** - Use GitHub Actions
- **Cloudflare Pages** - Connect your repo
- **AWS S3** - Upload the `dist` folder
- **Any static host** - Upload `dist` folder contents

### Quick Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

## 🎓 Learning Resources

New to React? Check out these resources:

- [React Documentation](https://react.dev/) - Official React docs
- [Vite Guide](https://vite.dev/guide/) - Learn about Vite
- [Tailwind CSS Docs](https://tailwindcss.com/docs) - Styling reference

## 🐛 Troubleshooting

### Port 8000 is already in use

```bash
# Use a different port
npm run dev -- --port 3000
```

### Styles not loading

Make sure you have `src/index.css` with:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

### Import errors

Check that path aliases are working:

```jsx
// This should work:
import Component from '@/Component';

// If not, use relative paths:
import Component from '../components/Component';
```

### Component not rendering

1. Check browser console for errors
2. Verify component export: `export default ComponentName`
3. Check import in `index.jsx`

## 💡 Tips & Tricks

### Use Path Aliases

```jsx
// Instead of:
import Button from '../../../../components/Button';

// Use:
import Button from '@/Button';
```

### Hot Module Replacement

Vite's HMR is ultra-fast! Just save your files and see changes instantly.

### VS Code Extensions

Recommended extensions:
- **ES7+ React/Redux/React-Native snippets**
- **Tailwind CSS IntelliSense**
- **ESLint**
- **Prettier**

### Code Snippets

Type `rafce` and press Tab to create a React component quickly!

## 🆘 Need Help?

If you run into issues:

1. Check the browser console for errors
2. Review the `README.md` in your project
3. Check [React DevTools](https://react.dev/learn/react-developer-tools)
4. Search [Stack Overflow](https://stackoverflow.com/questions/tagged/reactjs)

## ⚡ Next Steps

Now that you have a React project:

1. **Add routing** - Create more pages in `src/pages/`
2. **Add state** - Use React hooks for interactivity
3. **Connect APIs** - Fetch data from your backend
4. **Add forms** - Handle user input
5. **Deploy** - Share your site with the world!

---

**Happy coding!** 🎉

For more details, see [REACT_EXPORT_FEATURE.md](./REACT_EXPORT_FEATURE.md)


