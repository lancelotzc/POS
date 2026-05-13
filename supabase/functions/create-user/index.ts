import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the admin user making the request
    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token)
    
    if (userError || !user) {
      throw new Error('Unauthorized')
    }

    // Check if user is super_admin
    const { data: profile } = await supabaseClient.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'super_admin') {
      throw new Error('Forbidden: Only Super Admin can create accounts.')
    }

    // Get request payload
    const { email, password, role, tenant_id, store_id, full_name } = await req.json()

    if (!email || !password || !role) {
      throw new Error('Missing required fields')
    }

    // 1. Create the auth user securely
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true // Skip email confirmation
    })

    if (createError) throw createError

    // 2. Insert into profiles
    const { error: profileError } = await supabaseClient.from('profiles').insert({
      id: newUser.user.id,
      tenant_id: tenant_id || null,
      store_id: store_id || null,
      role: role,
      full_name: full_name || null
    })

    if (profileError) {
      // Rollback if profile creation fails
      await supabaseClient.auth.admin.deleteUser(newUser.user.id)
      throw profileError
    }

    return new Response(
      JSON.stringify({ user: newUser.user, message: 'User created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
