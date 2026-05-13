import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, DELETE, OPTIONS',
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
      throw new Error('Forbidden: Only Super Admin can manage accounts.')
    }

    const { action, target_user_id, password, role, tenant_id, store_id, full_name } = await req.json()

    if (!action || !target_user_id) {
      throw new Error('Missing required fields: action, target_user_id')
    }

    if (action === 'delete') {
      // Delete user from auth.users (cascades to profiles)
      const { error: deleteError } = await supabaseClient.auth.admin.deleteUser(target_user_id)
      if (deleteError) throw deleteError

      return new Response(
        JSON.stringify({ message: 'User deleted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    } 
    else if (action === 'update') {
      // 1. Update password if provided
      if (password && password.trim() !== '') {
        const { error: updateAuthError } = await supabaseClient.auth.admin.updateUserById(target_user_id, {
          password: password
        })
        if (updateAuthError) throw updateAuthError
      }

      // 2. Update profiles table
      const { error: updateProfileError } = await supabaseClient.from('profiles').update({
        role: role,
        tenant_id: role === 'super_admin' ? null : tenant_id,
        store_id: role === 'store_operator' ? store_id : null,
        full_name: full_name
      }).eq('id', target_user_id)

      if (updateProfileError) throw updateProfileError

      return new Response(
        JSON.stringify({ message: 'User updated successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }
    else {
      throw new Error('Invalid action')
    }

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
