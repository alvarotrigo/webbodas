# AI Website Generator Setup

This feature allows users to generate entire websites dynamically using OpenAI's API based on natural language descriptions.

## Setup Instructions

### 1. Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Sign in or create an account
3. Navigate to API Keys section
4. Create a new secret key
5. Copy the key (it starts with `sk-`)

### 2. Configure Environment Variable

Create a `.env` file in the project root directory:

```bash
# .env file
OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Important:** 
- Never commit the `.env` file to version control
- The `.env` file should be in `.gitignore`
- Keep your API key secure and private

### 3. Verify Setup

1. Make sure the `.env` file is in the project root (same level as `app.php`)
2. Restart your web server if needed
3. Test the feature by typing a description in the AI chat form

## How It Works

1. **User Input**: User types a description of the website they want (e.g., "I want a landing page for my SaaS product")

2. **API Call**: The description is sent to `api/generate-website.php` which:
   - Loads section metadata from `public/js/metadata.js`
   - Sends a prompt to OpenAI API with the user's description
   - Analyzes available sections and recommends which ones to include

3. **Response Processing**: OpenAI returns a JSON array of section IDs in the recommended order

4. **Section Addition**: The sections are automatically added to the preview in the recommended order

## API Endpoint

**Endpoint:** `api/generate-website.php`

**Method:** POST

**Request Body:**
```json
{
  "message": "I want a landing page for my SaaS product"
}
```

**Success Response:**
```json
{
  "success": true,
  "sections": [1, 15, 5, 27, 39],
  "count": 5
}
```

**Error Response:**
```json
{
  "error": "Error message here"
}
```

## OpenAI Model

The integration uses `gpt-4o-mini` model which provides a good balance between:
- Response quality
- Cost efficiency
- Response speed

You can change the model in `api/generate-website.php` by modifying the `model` parameter in the API call.

## Troubleshooting

### "OpenAI API key not configured" Error

- Make sure `.env` file exists in the project root
- Verify the `OPENAI_API_KEY` variable is set correctly
- Check that the API key starts with `sk-`
- Restart your web server

### "Failed to connect to OpenAI API" Error

- Check your internet connection
- Verify the API key is valid and has credits
- Check OpenAI API status at https://status.openai.com

### "No valid sections found" Error

- This usually means OpenAI returned section IDs that don't exist
- Check the API response in browser console
- Try a more specific description

### Sections Not Appearing

- Check browser console for errors
- Verify that `window.addSectionToPreview` is available
- Make sure the editor is fully loaded before using the chat

## Cost Considerations

- Each request uses OpenAI API tokens
- `gpt-4o-mini` is cost-effective (~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens)
- Typical requests use ~500-1000 tokens
- Monitor your usage at https://platform.openai.com/usage

## Security Notes

- Never expose your API key in client-side code
- Keep the `.env` file secure and out of version control
- Consider implementing rate limiting for production use
- Monitor API usage for unusual activity


