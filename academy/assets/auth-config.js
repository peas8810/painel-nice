// Configure somente a URL HTTPS do projeto Supabase e sua chave PUBLICÁVEL.
// NÃO use service_role, secret keys ou chaves Mercado Pago no navegador.
// Enquanto estes campos estiverem vazios, o cadastro permanecerá desativado.
window.ACADEMY_AUTH_CONFIG = Object.freeze({
  url: "",
  publishableKey: ""
});
