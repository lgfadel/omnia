import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Initialize Supabase clients
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

    const supabaseAnon = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get the Authorization header from the request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseAnon.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if the authenticated user has ADMIN role
    const { data: currentUser, error: userError } = await supabaseAnon
      .from('omnia_users')
      .select('roles')
      .eq('auth_user_id', user.id)
      .single()

    if (userError || !currentUser || !currentUser.roles.includes('ADMIN')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { 
          status: 403, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Parse request body
    const { userId } = await req.json()

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('Deleting user:', userId)

    // Get user data from omnia_users to get the auth_user_id
    const { data: userData, error: getUserError } = await supabaseAnon
      .from('omnia_users')
      .select('auth_user_id, name, email')
      .eq('id', userId)
      .single()

    if (getUserError || !userData) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Check if user has any atas associated
    const { data: atasCount, error: countError } = await supabaseAnon
      .from('omnia_atas')
      .select('id')
      .or(`secretary_id.eq.${userId},responsible_id.eq.${userId},created_by.eq.${userId}`)
      .limit(1)

    if (countError) {
      console.error('Error checking user atas:', countError)
      return new Response(
        JSON.stringify({ error: 'Error checking user associations' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    if (atasCount && atasCount.length > 0) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete user with associated records' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Delete user from omnia_users table first
    const { error: deleteUserError } = await supabaseAnon
      .from('omnia_users')
      .delete()
      .eq('id', userId)

    if (deleteUserError) {
      console.error('Error deleting from omnia_users:', deleteUserError)
      return new Response(
        JSON.stringify({ error: 'Error deleting user from database' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Delete user from auth.users table using admin client
    if (userData.auth_user_id) {
      const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(
        userData.auth_user_id
      )

      if (deleteAuthError) {
        console.error('Error deleting from auth.users:', deleteAuthError)
        // Even if auth deletion fails, we've already deleted from omnia_users
        // Log the error but don't fail the entire operation
        console.log('User deleted from omnia_users but failed to delete from auth:', userData.email)
      } else {
        console.log('User successfully deleted from both omnia_users and auth.users:', userData.email)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'User deleted successfully',
        deletedUser: {
          id: userId,
          name: userData.name,
          email: userData.email
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})