/* Academy Experience 2.0: navigation behavior without altering protocol forms. */
(()=>{const student=document.getElementById('student-view');if(!student)return;const nav=student.querySelector('.mobile-quick-nav');if(!nav)return;const links=[...nav.querySelectorAll('a[href^="#"]')];const mark=link=>{for(const a of links){if(a===link)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}};
links.forEach(a=>a.addEventListener('click',()=>mark(a)));mark(links[0]);
const hero=student.querySelector('.academy-hero-main');hero?.addEventListener('click',()=>{const target=links.find(a=>a.getAttribute('href')==='#new-request');if(target)mark(target)});
const style=document.createElement('meta');style.name='theme-color';style.content='#111827';document.head.querySelector('meta[name="theme-color"]')?.replaceWith(style);
})();