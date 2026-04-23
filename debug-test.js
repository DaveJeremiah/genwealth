// Debug test to check current function status
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://eaemklxptkiccdgtwdtp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVhZW1rbHhwdGtpY2NkZ3R3ZHRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDM1NzQ5MTIsImV4cCI6MjA1OTE1MDkxMn0.7T60X_5kxXLnYkJOJx8HNWQZZNq8vG3xQ5X3gQaZ3k';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function debugTest() {
  console.log('=== Testing Supabase Functions Status ===\n');
  
  // Test 1: Check if function exists and is accessible
  try {
    console.log('1. Testing function accessibility...');
    const response = await fetch('https://eaemklxptkiccdgtwdtp.supabase.co/functions/v1/ai-chat', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://localhost:8081',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    });
    
    console.log('OPTIONS Status:', response.status);
    console.log('CORS Headers:', {
      'Access-Control-Allow-Origin': response.headers.get('Access-Control-Allow-Origin'),
      'Access-Control-Allow-Methods': response.headers.get('Access-Control-Allow-Methods'),
      'Access-Control-Allow-Headers': response.headers.get('Access-Control-Allow-Headers')
    });
  } catch (error) {
    console.error('OPTIONS test failed:', error.message);
  }

  // Test 2: Check function with proper auth (simulate logged in user)
  try {
    console.log('\n2. Testing with simulated user session...');
    
    // First try to create a session
    const { data: signInData, error: signInError } = await supabase.auth.signInAnonymously();
    console.log('Anonymous sign-in result:', { signInData, signInError });
    
    if (signInData?.session) {
      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          messages: [{ role: 'user', content: 'Hello' }],
          financialContext: {}
        }
      });
      
      console.log('Function call with auth:', { data, error });
    } else {
      console.log('Could not create anonymous session');
    }
  } catch (error) {
    console.error('Auth test failed:', error.message);
  }

  // Test 3: Check function secrets status
  try {
    console.log('\n3. Testing parse-transactions function...');
    const { data, error } = await supabase.functions.invoke('parse-transactions', {
      body: { input: 'Test transaction: spent 50 UGX on coffee' }
    });
    
    console.log('Parse transactions result:', { data, error });
  } catch (error) {
    console.error('Parse test failed:', error.message);
  }
}

debugTest().catch(console.error);
