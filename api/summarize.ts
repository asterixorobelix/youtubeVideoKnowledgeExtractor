import Anthropic from '@anthropic-ai/sdk';

export const config = { runtime: 'edge' };

const SYSTEM_PROMPT = `You are a video transcript analyzer. Analyze the provided YouTube video transcript and return a JSON object with this exact structure:
{
  "title": "A concise, descriptive title for the video content",
  "key_points": ["3-10 key takeaways from the video"],
  "topics": ["1-5 main topics covered"],
  "notable_quotes": [{"text": "exact quote", "context": "brief context"}]
}
Return ONLY valid JSON, no markdown formatting or code blocks.`;

interface SummarizeRequest {
  transcript: string;
  apiKey: string;
  action: 'summarize' | 'count-tokens';
}

export default async function handler(request: Request) {
  // CORS headers for local dev
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  // Handle preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Only allow POST
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ success: false, error: 'Method not allowed' }),
      { status: 405, headers: corsHeaders }
    );
  }

  try {
    // Parse request body
    const body: SummarizeRequest = await request.json();
    const { transcript, apiKey, action } = body;

    // Validate required fields
    if (!transcript || !apiKey || !action) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required fields: transcript, apiKey, action',
        }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Create Anthropic client with user's API key
    const client = new Anthropic({
      apiKey,
      dangerouslyAllowBrowser: false,
    });

    // Create timeout promise (60 seconds for Claude processing)
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Request timeout')), 60000);
    });

    if (action === 'count-tokens') {
      // Count tokens for cost estimation
      const countResult = await Promise.race([
        client.messages.countTokens({
          model: 'claude-sonnet-4-20250514',
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: transcript,
            },
          ],
        }),
        timeoutPromise,
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          inputTokens: countResult.input_tokens,
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    if (action === 'summarize') {
      // Call Claude API for summarization
      const response = await Promise.race([
        client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: transcript,
            },
          ],
        }),
        timeoutPromise,
      ]);

      // Check for truncation
      if (response.stop_reason === 'max_tokens') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Response truncated - output exceeded max tokens',
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Extract text from response
      const textContent = response.content.find((block) => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'No text content in Claude response',
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      // Parse JSON response
      let summary;
      try {
        summary = JSON.parse(textContent.text);
      } catch {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to parse Claude JSON response',
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          summary,
          usage: {
            input_tokens: response.usage.input_tokens,
            output_tokens: response.usage.output_tokens,
          },
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Invalid action
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid action. Must be "summarize" or "count-tokens"',
      }),
      { status: 400, headers: corsHeaders }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle timeout
    if (errorMessage === 'Request timeout') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Request timed out after 60 seconds',
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Handle authentication errors (401)
    if (errorMessage.includes('authentication') || errorMessage.includes('api_key')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid Anthropic API key',
        }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Handle rate limit errors (429)
    if (errorMessage.includes('rate_limit') || errorMessage.includes('429')) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
        }),
        { status: 429, headers: corsHeaders }
      );
    }

    // Generic error
    return new Response(
      JSON.stringify({
        success: false,
        error: `Claude API error: ${errorMessage}`,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
}
