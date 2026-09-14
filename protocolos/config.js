window.NICE_PORTAL_CONFIG = Object.freeze({
  API_URL: "https://script.google.com/macros/s/AKfycby2HN1DU9SXupv2WlthavWzXMr5k1RsdpzDL-Dahd9NN2-TvDvEqT-wqMM6F9fP2DnY/exec",

  FORM_PROTOCOLO_URL: "https://forms.gle/vQoChVX2mj61KZz27",
  FORM_RELATORIO_URL: "https://docs.google.com/forms/d/e/1FAIpQLSei77aFurJhdDZmmrOPZRAssw5OS9NOoT5xRGK8JwRMxxSlTg/viewform?usp=sharing&ouid=117860724975449383583",
  PAINEL_URL: "../atual/",

  REFRESH_SECONDS: 60,
  PUBLIC_TITLE: "Sistema de Gestão de Protocolos e Análise de Dados®",
  INSTITUTION: "AlfaUnipac"
});

(()=>{
  const icon='../assets/amonia-logo.svg';

  let favicon=document.querySelector('link[rel="icon"]');
  if(!favicon){
    favicon=document.createElement('link');
    favicon.rel='icon';
    favicon.type='image/svg+xml';
    document.head.appendChild(favicon);
  }
  favicon.href=icon;

  const logo=document.querySelector('.top .logo');
  if(logo){
    logo.innerHTML='<img src="'+icon+'" alt="" aria-hidden="true">';
    logo.style.background='rgba(255,255,255,.96)';
    logo.style.borderColor='rgba(255,255,255,.35)';
    logo.style.overflow='hidden';
    const img=logo.querySelector('img');
    if(img){
      img.style.width='42px';
      img.style.height='42px';
      img.style.objectFit='contain';
      img.style.display='block';
    }
  }
})();
