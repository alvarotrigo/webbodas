import gulp from 'gulp';
import terser from 'gulp-terser';
import cleanCSS from 'gulp-clean-css';
import rev from 'gulp-rev';
import htmlmin from 'gulp-html-minifier-terser';
import rename from 'gulp-rename';
import { deleteAsync } from 'del';

const paths = {
  js: ['public/js/**/*.js', '!public/js/**/*.min.js', '!public/js/tinymce/**/*'],
  css: ['public/css/**/*.css', '!public/css/**/*.min.css'],
  html: 'index-src.html',
  dest: 'public/dist/',
  htmlDest: './',
  manifest: 'public/dist/rev-manifest.json'
};

// Clean dist folder
export const clean = () => deleteAsync(['public/dist']);

// Minify & revision JS
export const scripts = () => {
  return gulp.src(paths.js, { base: 'public' })
    .pipe(terser({
      compress: {
        drop_console: false, // Keep console logs for debugging
        drop_debugger: true
      },
      format: {
        comments: false // Remove comments
      }
    }))
    .pipe(rev())
    .pipe(gulp.dest(paths.dest))
    .pipe(rev.manifest(paths.manifest, { 
      base: paths.dest, 
      merge: true 
    }))
    .pipe(gulp.dest(paths.dest));
};

// Minify & revision CSS
export const styles = () => {
  return gulp.src(paths.css, { base: 'public' })
    .pipe(cleanCSS({
      level: 0, // No optimizations - preserves spaces in :not() selectors
      compatibility: 'ie11' // Browser compatibility
    }))
    .pipe(rev())
    .pipe(gulp.dest(paths.dest))
    .pipe(rev.manifest(paths.manifest, {
      base: paths.dest,
      merge: true
    }))
    .pipe(gulp.dest(paths.dest));
};

// Minify index-src.html → index.html (inline CSS & JS)
export const minifyIndexHtml = () => {
  return gulp.src(paths.html)
    .pipe(htmlmin({
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: true,
      removeAttributeQuotes: false,
      keepClosingSlash: true,
      caseSensitive: true
    }))
    .pipe(rename('index.html'))
    .pipe(gulp.dest(paths.htmlDest));
};

// Build task
export const build = gulp.series(clean, gulp.parallel(scripts, styles), minifyIndexHtml);
export default build;
