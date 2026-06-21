// ==========================================
// APEX AI - OpenRouter Chat API
// Vercel Serverless Function
// ==========================================

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { messages, userProfile } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'Invalid request: messages array required' });
  }

  const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
  const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-2.0-flash-exp:free';

  if (!OPENROUTER_API_KEY) {
    return res.status(500).json({ error: 'OpenRouter API key not configured' });
  }

  // Build a detailed system prompt from the user's profile data
  const systemPrompt = buildSystemPrompt(userProfile);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://apex-ai-gym.vercel.app',
        'X-Title': 'APEX AI Gym Assistant',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('OpenRouter error:', errorData);
      return res.status(response.status).json({ error: errorData.error?.message || 'OpenRouter API error' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || 'Sorry, I could not generate a response.';

    return res.status(200).json({ reply });

  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function buildSystemPrompt(profile) {
  if (!profile) {
    return `You are APEX, an elite AI fitness coach and gym assistant. Be motivating, knowledgeable, and personalized. Answer questions about workouts, nutrition, recovery, and fitness goals. Keep responses concise but impactful. Use emojis sparingly for energy.`;
  }

  const {
    name, email, goal, experience, weight, height, age, gender
  } = profile;

  // Calculate BMI if possible
  let bmiInfo = '';
  if (weight && height) {
    const heightM = parseFloat(height) / 100;
    const bmi = (parseFloat(weight) / (heightM * heightM)).toFixed(1);
    let bmiCategory = '';
    if (bmi < 18.5) bmiCategory = 'Underweight';
    else if (bmi < 25) bmiCategory = 'Normal weight';
    else if (bmi < 30) bmiCategory = 'Overweight';
    else bmiCategory = 'Obese';
    bmiInfo = `BMI: ${bmi} (${bmiCategory})`;
  }

  return `You are APEX, an elite AI personal fitness coach built into the APEX AI gym platform.

## User Profile:
- Name/Email: ${name || email || 'Member'}
- Goal: ${goal || 'Not specified'}
- Fitness Experience Level: ${experience || 'Not specified'}
- Age: ${age || 'Not specified'} years
- Gender: ${gender || 'Not specified'}
- Weight: ${weight ? weight + ' kg' : 'Not specified'}
- Height: ${height ? height + ' cm' : 'Not specified'}
${bmiInfo ? `- ${bmiInfo}` : ''}

## Your Role:
You are their dedicated personal trainer and nutritionist. You have full access to their fitness profile and must tailor EVERY response specifically to them. 

## Guidelines:
1. Always reference their specific stats, goals, and experience level when relevant
2. Give actionable, specific advice based on their profile (not generic tips)
3. For workout plans, consider their experience level (${experience || 'beginner'})
4. For nutrition advice, factor in their weight (${weight || '?'} kg) and goal (${goal || 'general fitness'})
5. Be motivating, energetic, and like a real coach who knows them personally
6. Keep responses clear and well-structured with bullet points when listing exercises/meals
7. If they ask about exercises, tailor intensity to their experience level
8. Use their goal (${goal || 'fitness'}) as the North Star for all advice
9. Occasionally mention their stats to show you're tracking their progress
10. Respond in the same language the user uses (Hindi or English)

Remember: You are not a generic chatbot. You are THEIR personal APEX coach who knows everything about them!`;
}
