-- =====================================================
-- TRIGGER PARA SINCRONIZAÇÃO AUTOMÁTICA DE USUÁRIOS
-- =====================================================
-- Criado em: $(date)
-- Objetivo: Sincronizar automaticamente novos usuários de auth.users para omnia_users

-- 1. FUNÇÃO PARA SINCRONIZAÇÃO AUTOMÁTICA
CREATE OR REPLACE FUNCTION sync_new_user_to_omnia()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_name TEXT;
    user_roles TEXT[];
BEGIN
    -- Determinar nome baseado no email
    IF NEW.email LIKE '%@euro.adm.br' THEN
        -- Para emails do domínio euro.adm.br
        IF NEW.email IN ('euro@euro.adm.br', 'londrina@euro.adm.br') THEN
            -- Emails genéricos administrativos
            user_name := CASE 
                WHEN NEW.email = 'euro@euro.adm.br' THEN 'Euro Administração'
                WHEN NEW.email = 'londrina@euro.adm.br' THEN 'Euro Londrina'
                ELSE 'Usuário Euro'
            END;
            user_roles := ARRAY['ADMIN'];
        ELSE
            -- Emails com nomes pessoais
            user_name := INITCAP(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', ' '));
            user_roles := ARRAY['SECRETARIO'];
        END IF;
    ELSIF NEW.email LIKE '%@loovus.%' THEN
        -- Emails do domínio loovus (desenvolvedores/teste)
        user_name := INITCAP(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', ' '));
        user_roles := ARRAY['ADMIN'];
    ELSE
        -- Outros domínios - role básico
        user_name := INITCAP(REPLACE(SPLIT_PART(NEW.email, '@', 1), '.', ' '));
        user_roles := ARRAY['SECRETARIO'];
    END IF;

    -- Inserir usuário em omnia_users
    INSERT INTO omnia_users (
        id,
        name,
        email,
        roles,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        user_name,
        NEW.email,
        user_roles,
        NEW.created_at,
        NOW()
    )
    ON CONFLICT (id) DO NOTHING; -- Evita erro se usuário já existir

    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        -- Log do erro (opcional)
        RAISE WARNING 'Erro ao sincronizar usuário %: %', NEW.email, SQLERRM;
        RETURN NEW; -- Não falha a criação do usuário em auth.users
END;
$$;

-- 2. CRIAR TRIGGER NA TABELA auth.users
DROP TRIGGER IF EXISTS trigger_sync_new_user ON auth.users;

CREATE TRIGGER trigger_sync_new_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION sync_new_user_to_omnia();

-- 3. FUNÇÃO PARA SINCRONIZAÇÃO MANUAL (caso necessário)
CREATE OR REPLACE FUNCTION manual_sync_all_users()
RETURNS TABLE(
    action TEXT,
    user_id UUID,
    email TEXT,
    name TEXT,
    roles TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    auth_user RECORD;
    user_name TEXT;
    user_roles TEXT[];
BEGIN
    -- Sincronizar todos os usuários faltantes
    FOR auth_user IN 
        SELECT au.id, au.email, au.created_at
        FROM auth.users au
        LEFT JOIN omnia_users ou ON au.id = ou.id
        WHERE ou.id IS NULL
    LOOP
        -- Aplicar mesma lógica da função de trigger
        IF auth_user.email LIKE '%@euro.adm.br' THEN
            IF auth_user.email IN ('euro@euro.adm.br', 'londrina@euro.adm.br') THEN
                user_name := CASE 
                    WHEN auth_user.email = 'euro@euro.adm.br' THEN 'Euro Administração'
                    WHEN auth_user.email = 'londrina@euro.adm.br' THEN 'Euro Londrina'
                    ELSE 'Usuário Euro'
                END;
                user_roles := ARRAY['ADMIN'];
            ELSE
                user_name := INITCAP(REPLACE(SPLIT_PART(auth_user.email, '@', 1), '.', ' '));
                user_roles := ARRAY['SECRETARIO'];
            END IF;
        ELSIF auth_user.email LIKE '%@loovus.%' THEN
            user_name := INITCAP(REPLACE(SPLIT_PART(auth_user.email, '@', 1), '.', ' '));
            user_roles := ARRAY['ADMIN'];
        ELSE
            user_name := INITCAP(REPLACE(SPLIT_PART(auth_user.email, '@', 1), '.', ' '));
            user_roles := ARRAY['SECRETARIO'];
        END IF;

        -- Inserir usuário
        INSERT INTO omnia_users (
            id, name, email, roles, created_at, updated_at
        ) VALUES (
            auth_user.id, user_name, auth_user.email, user_roles, auth_user.created_at, NOW()
        );

        -- Retornar resultado
        action := 'SINCRONIZADO';
        user_id := auth_user.id;
        email := auth_user.email;
        name := user_name;
        roles := user_roles;
        RETURN NEXT;
    END LOOP;
END;
$$;

-- 4. GRANTS NECESSÁRIOS
GRANT EXECUTE ON FUNCTION sync_new_user_to_omnia() TO authenticated;
GRANT EXECUTE ON FUNCTION manual_sync_all_users() TO authenticated;

-- 5. COMENTÁRIOS
COMMENT ON FUNCTION sync_new_user_to_omnia() IS 'Sincroniza automaticamente novos usuários de auth.users para omnia_users';
COMMENT ON FUNCTION manual_sync_all_users() IS 'Sincroniza manualmente todos os usuários faltantes';

-- =====================================================
-- COMO USAR:
-- =====================================================
-- 1. Execute este script para criar o trigger
-- 2. Para sincronização manual dos usuários existentes:
--    SELECT * FROM manual_sync_all_users();
-- 3. Novos usuários serão sincronizados automaticamente
--
-- REGRAS DE ROLES:
-- - @euro.adm.br genéricos (euro@, londrina@) → ADMIN
-- - @euro.adm.br com nomes → SECRETARIO  
-- - @loovus.% → ADMIN (desenvolvedores)
-- - Outros domínios → SECRETARIO
-- =====================================================