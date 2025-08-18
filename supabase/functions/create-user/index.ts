import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Create client for checking permissions
    const authHeader = req.headers.get('Authorization')!
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        global: {
          headers: {
            Authorization: authHeader,
          }
        }
      }
    )

    // Check if user has admin permissions
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error('Error getting user:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: userProfile, error: profileError } = await supabaseClient
      .from('omnia_users')
      .select('roles')
      .eq('auth_user_id', user.id)
      .single()

    if (profileError || !userProfile?.roles?.includes('ADMIN')) {
      console.error('User not admin:', profileError)
      return new Response(
        JSON.stringify({ error: 'Access denied. Admin role required.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request body
    const { name, email, roles, avatarUrl, color, password } = await req.json()

    console.log('Creating user:', { name, email, roles })

    // Use provided password or generate temporary one
    const userPassword = password && password.trim() ? password : Math.random().toString(36).slice(-12) + 'A1!'
    const isTemporaryPassword = !password || !password.trim()

    // Create user in auth.users using admin client
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: userPassword,
      email_confirm: true,
      user_metadata: {
        name
      }
    })

    if (authError) {
      console.error('Error creating auth user:', authError)
      return new Response(
        JSON.stringify({ error: `Erro ao criar usuário: ${authError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Auth user created:', authUser.user.id)

    // Wait a moment for trigger to create omnia_users record
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Update the user in omnia_users with correct roles
    const { data: updatedUser, error: updateError } = await supabaseAdmin
      .from('omnia_users')
      .update({
        name,
        roles,
        avatar_url: avatarUrl,
        color
      })
      .eq('auth_user_id', authUser.user.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating user roles:', updateError)
      return new Response(
        JSON.stringify({ error: `Erro ao configurar papéis: ${updateError.message}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User created successfully:', updatedUser)

    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          roles: updatedUser.roles,
          avatarUrl: updatedUser.avatar_url,
          color: updatedUser.color
        },
        ...(isTemporaryPassword ? { tempPassword: userPassword } : {})
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})