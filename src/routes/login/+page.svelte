<script lang="ts">
	import Icon from "@iconify/svelte";
    import { enhance } from "$app/forms";

	import { fade, scale } from "svelte/transition";
	import type { PageProps } from "./$types";
	import { goto, invalidateAll } from "$app/navigation";

    let { form }: PageProps = $props();

    let formMessage = $state('');

    let viewState = $state('login')

    // HTML Elements
    let passwordInput: HTMLInputElement | undefined = $state();
    let confirmPasswordInput: HTMLInputElement | undefined = $state();

    // Visible elements
    let passwordIsVisible = $state(false);
    let confirmPasswordIsVisible = $state(false);

    // Toggle Visible Elements
    function togglePasswordVisibility (e: Event) {
        passwordIsVisible = !passwordIsVisible;
        if (passwordInput) {
            e.preventDefault();
            passwordInput.focus();
        }
    }
    function toggleConfirmPasswordVisibility (e: Event) {
        confirmPasswordIsVisible = !confirmPasswordIsVisible;
        if (confirmPasswordInput) {
            e.preventDefault();
            confirmPasswordInput.focus();
        }
    }
    

    function cancelFocus (e: FocusEvent) {
        const target = e.target as HTMLButtonElement;
        if (target) {
            setTimeout(() => {
                target.blur();
            }, 200)
        }
    }

    // Effects
    $effect(() => {
        if (formMessage) {
            setTimeout(() => {
                formMessage = ""
            }, 6000);
            window.scrollTo({top: 10000000})
        }
    })


</script>

<div in:fade class="min-h-[70vh] flex items-center justify-center">
    <div class="relative w-full max-w-md flex flex-col gap-6 p-8 rounded-2xl bg-surface-1/80 border border-white/4">
        <!-- Thread corner accents -->
        <div class="absolute top-0 left-0 w-10 h-10 border-l-2 border-t-2 border-brand-400/20 rounded-tl-2xl pointer-events-none"></div>
        <div class="absolute bottom-0 right-0 w-10 h-10 border-r-2 border-b-2 border-brand-400/20 rounded-br-2xl pointer-events-none"></div>

        <!-- Thread accent line at top -->
        <div class="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-brand-400/30 to-transparent"></div>

        {#if viewState === 'login'}
        <h2 in:fade class="text-3xl font-bold text-brand-400 text-center tracking-wider">
            Login
        </h2>
        <form in:fade method="post" action="?/login" use:enhance={({formElement}) => {
            return async ({ result }) => {
                if (result.type === "failure") {
                    if (result.data?.message) {
                        formMessage = result.data.message as string;
                    }
                } else if (result.type === "redirect") {
                    formElement.reset();
                    await invalidateAll()
                }
            }
        }}
        class="flex flex-col gap-4">
            <div class="flex flex-col gap-2">
                <label for="username" class="text-sm font-medium text-text-secondary">Usuario</label>
                <input type="text" id="user" name="username" autocomplete="off" required
                class="input-thread" />
            </div>
            <div class="flex flex-col gap-2">
                <label for="password" class="text-sm font-medium text-text-secondary">Contraseña</label>
                <div class="relative">
                    <input bind:this={passwordInput} autocomplete="off" type={passwordIsVisible ? 'text' : 'password'} id="password" name="password" required class="input-thread pr-12" />
                    <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-brand-400 transition-colors" onclick={(e)=>togglePasswordVisibility(e)}>
                        {#if passwordIsVisible}
                        <div in:scale>
                            <Icon icon="hugeicons:view" class="text-lg" />
                        </div>
                        {:else}  
                        <div in:scale>
                            <Icon icon="hugeicons:view-off" class="text-lg" />
                        </div>
                        {/if}
                    </button>
                </div>
            </div>
            <button class="btn-primary w-full mt-2"
            onfocus={(e) => cancelFocus(e)}
            >
                Iniciar Sesión
            </button>
        </form>
        {:else}   
        <h2 in:fade class="text-3xl font-bold text-brand-400 text-center tracking-wider">
            Register
        </h2>
        <form in:fade method="post" action="?/register" use:enhance={({formElement}) => {
            return async ({ result }) => {
                if (result.type === "failure") {
                    if (result.data?.message) {
                        formMessage = result.data.message as string;
                    }
                } else if (result.type === "success") {
                    formElement.reset();
                    await invalidateAll()
                    viewState = 'login';
                    formMessage = 'Registro exitoso';
                }
            }
        }}
        class="flex flex-col gap-4"
        >
            <div class="flex flex-col gap-2">
                <label for="username" class="text-sm font-medium text-text-secondary">Usuario</label>
                <input type="text" id="user" name="username" autocomplete="off" required
                class="input-thread" minlength="3" maxlength="31"/>
            </div>
            <div class="flex flex-col gap-2">
                <label for="password" class="text-sm font-medium text-text-secondary">Contraseña</label>
                <div class="relative">
                    <input bind:this={passwordInput} autocomplete="off" type={passwordIsVisible ? 'text' : 'password'} id="password" name="password" required class="input-thread pr-12" 
                    minlength="6" maxlength="255"
                    />
                    <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-brand-400 transition-colors" onclick={(e)=>togglePasswordVisibility(e)}>
                        {#if passwordIsVisible}
                        <div in:scale>
                            <Icon icon="hugeicons:view" class="text-lg" />
                        </div>
                        {:else}  
                        <div in:scale>
                            <Icon icon="hugeicons:view-off" class="text-lg" />
                        </div>
                        {/if}
                    </button>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <label for="confirm_password" class="text-sm font-medium text-text-secondary">Confirmar contraseña</label>
                <div class="relative">
                    <input bind:this={confirmPasswordInput} autocomplete="off" type={confirmPasswordIsVisible ? 'text' : 'password'} id="confirm_password" name="confirm_password" required class="input-thread pr-12" 
                    minlength="6" maxlength="255"
                    />
                    <button type="button" class="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-text-muted hover:text-brand-400 transition-colors" onclick={(e)=>toggleConfirmPasswordVisibility(e)}>
                        {#if confirmPasswordIsVisible}
                        <div in:scale>
                            <Icon icon="hugeicons:view" class="text-lg" />
                        </div>
                        {:else}  
                        <div in:scale>
                            <Icon icon="hugeicons:view-off" class="text-lg" />
                        </div>
                        {/if}
                    </button>
                </div>
            </div>
            <div class="flex flex-col gap-2">
                <label for="user_token" class="text-sm font-medium text-text-secondary">Token de usuario</label>
                <input type="text" id="user_token" name="user_token" autocomplete="off"
                class="input-thread" required/>
            </div>
            <button class="btn-primary w-full mt-2"
            onfocus={(e) => cancelFocus(e)}
            >
                Registrarse
            </button>
        </form>
        {/if}

        <!-- Thread divider -->
        <div class="flex items-center gap-4">
            <div class="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            <span class="text-xs text-text-muted uppercase tracking-widest">o</span>
            <div class="flex-1 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>

        <div class="w-full flex flex-col place-items-center">
        {#if viewState === 'login'}
        <button in:fade class="text-sm text-text-muted hover:text-brand-400 transition-colors" 
        onfocus={(e) => cancelFocus(e)}
        onclick={() => viewState = "register"}
            >
                Registrarse
        </button>
        {:else}
        <button in:fade class="text-sm text-text-muted hover:text-brand-400 transition-colors" 
        onfocus={(e) => cancelFocus(e)}
        onclick={() => viewState = "login"}
        >
           Iniciar sesión
        </button>
        {/if}
        </div>

        {#if formMessage}
        <div transition:scale={{ duration: 200, start: 0.9 }} class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-full bg-brand-500/10 text-brand-400 text-sm font-medium">
            <Icon icon="mdi:check-circle" class="text-lg" />
            {formMessage}
        </div>
        {/if}
    </div>
</div>
