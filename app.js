/* Sincroniza a altura com a área realmente visível no Android/SPCK. */
(function () {
  let resizeTimer;
  function updateAppHeight() {
    const visibleHeight = window.visualViewport && window.visualViewport.height;
    const height = visibleHeight || window.innerHeight;
    document.documentElement.style.setProperty("--app-height", Math.round(height) + "px");
  }
  function scheduleUpdate() {
    clearTimeout(resizeTimer);
    updateAppHeight();
    resizeTimer = setTimeout(updateAppHeight, 180);
    setTimeout(updateAppHeight, 450);
  }
  updateAppHeight();
  window.addEventListener("resize", scheduleUpdate, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleUpdate, { passive: true });
    window.visualViewport.addEventListener("scroll", updateAppHeight, { passive: true });
  }
  document.addEventListener("focusout", function () {
    setTimeout(updateAppHeight, 120);
    setTimeout(updateAppHeight, 350);
    setTimeout(updateAppHeight, 650);
  });
})();

/* ACADEMIA ÁGUIA — JavaScript puro otimizado. */
"use strict";

import { initializeApp } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, updatePassword, signOut, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-auth.js";
import { getFirestore, collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

/* Insira  real neste campo, diretamente no SPCK. */
const firebaseConfig = {
  apiKey: "AIzaSyDH2XQlOTnerd232XLJdcMAqM4NsTSsd-s",
  authDomain: "academia-aguia.firebaseapp.com",
  projectId: "academia-aguia",
  storageBucket: "academia-aguia.firebasestorage.app",
  messagingSenderId: "573048573909",
  appId: "1:573048573909:web:f129a3f044543ec9e4b75c"
};
const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const firestore = getFirestore(firebaseApp);
const secondaryApp = initializeApp(firebaseConfig, "AcademiaAguiaUserCreation");
const secondaryAuth = getAuth(secondaryApp);
const authEmail = value => {
  const v=String(value||"").trim().toLowerCase();
  return v.includes("@") ? v : `${v.replace(/[^a-z0-9._-]/g,"")}@academia-aguia.com`;
};
let db={users:[],subjects:[],posts:[],questions:[],attempts:[],notices:[],library:[]};

const subjectsDefault = [
  "Língua Portuguesa",
  "Matemática",
  "Raciocínio Lógico",
  "História de Pernambuco",
  "Geografia",
  "Informática",
  "Direito Constitucional",
  "Direito Administrativo",
  "Direitos Humanos",
  "Legislação aplicada à PMPE"
];
let currentUser=null, page="dashboard", draftBlocks=[];
async function readCollection(name){const snap=await getDocs(collection(firestore,name));return snap.docs.map(d=>({id:d.id,...d.data()}));}
async function loadCloudData(){
  const attemptPromise=currentUser.role==="admin" ? readCollection("attempts") : getDocs(query(collection(firestore,"attempts"),where("userId","==",currentUser.id))).then(s=>s.docs.map(d=>({id:d.id,...d.data()})));
  const [users,subjects,posts,questions,attempts,notices,library]=await Promise.all([readCollection("users"),readCollection("subjects"),readCollection("posts"),readCollection("questions"),attemptPromise,readCollection("notices"),readCollection("library")]);
  db={users,subjects,posts,questions,attempts,notices,library};
  if(currentUser.role==="admin" && !subjects.length){await Promise.all(subjectsDefault.map((name,i)=>setDoc(doc(firestore,"subjects","s"+i),{name})));db.subjects=await readCollection("subjects");}
  currentUser=db.users.find(u=>u.id===auth.currentUser.uid)||currentUser;
}
async function saveDoc(name,item){const data={...item};delete data.id;await setDoc(doc(firestore,name,item.id),data);}
async function removeDoc(name,id){await deleteDoc(doc(firestore,name,id));}
function reportCloudError(err){console.error(err);const map={"auth/invalid-credential":"Matrícula ou senha incorretas.","auth/user-not-found":"Conta não encontrada.","auth/wrong-password":"Matrícula ou senha incorretas.","auth/email-already-in-use":"Essa matrícula já está cadastrada.","auth/weak-password":"A senha precisa ter pelo menos 6 caracteres.","permission-denied":"Operação bloqueada pelas regras do Firestore. O usuário pode não ter permissão para esta disciplina."};toast(map[err.code]||"Não foi possível concluir. Verifique a conexão e a configuração do Firebase.",true);}
function uid(){return "id-"+Date.now().toString(36)+"-"+Math.random().toString(36).slice(2,7)}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function toast(msg,bad=false){const el=document.getElementById("toast");el.textContent=msg;el.style.background=bad?"#a53b43":"#168447";el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800)}
function roleName(r){return r==="admin"?"Administrador":r==="teacher"?"Professor":"Aluno"}
function subjectName(id){return db.subjects.find(s=>s.id===id)?.name||"Sem disciplina"}
function teacherSubjectId(){return currentUser?.role==="teacher" ? (currentUser.subjectId||"") : ""}
function subjectOptionsForCurrentUser(){
  const list=currentUser?.role==="teacher" ? db.subjects.filter(s=>s.id===teacherSubjectId()) : db.subjects;
  return list.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("");
}
function safeTeacherPhoto(path){
  const value=String(path||"").trim();
  if(!value || !/^assets\/imagens\/[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/i.test(value)) return "";
  return value;
}
function setScreen(id){["loginScreen","passwordScreen","mainScreen"].forEach(x=>document.getElementById(x).classList.toggle("hidden",x!==id))}


async function login(e){
  e.preventDefault();

  const username=document.getElementById("loginUser").value.trim();
  const password=document.getElementById("loginPassword").value;

  if(!username||!password){
    toast("Informe sua matrícula e senha.",true);
    return;
  }

  let etapa="Iniciando login";

  try{
    etapa="Autenticando no Firebase";

    const credential=await signInWithEmailAndPassword(
      auth,
      authEmail(username),
      password
    );

    etapa="Buscando perfil no Firestore";

    const profile=await getDoc(
      doc(firestore,"users",credential.user.uid)
    );

    if(!profile.exists()){
      await signOut(auth);
      throw new Error("A autenticação funcionou, mas o perfil não foi encontrado.");
    }

    currentUser={id:profile.id,...profile.data()};

    etapa="Carregando dados do sistema";

    await loadCloudData();

    etapa="Abrindo a plataforma";

    if(currentUser.mustChange===true){
      setScreen("passwordScreen");
    }else{
      enterApp();
    }

  }catch(err){
    console.error("ERRO ACADEMIA ÁGUIA:",err);

    alert(
      "DIAGNÓSTICO DO LOGIN\n\n"+
      "Etapa: "+etapa+"\n\n"+
      "Código: "+(err.code||"Sem código")+"\n\n"+
      "Mensagem: "+(err.message||"Erro desconhecido")
    );
  }
}


function enterApp(){
  setScreen("mainScreen");
  document.getElementById("userLabel").textContent=currentUser.name+" • "+roleName(currentUser.role);
  document.getElementById("teacherNav").classList.toggle("hidden",currentUser.role!=="teacher");
  document.getElementById("adminNav").classList.toggle("hidden",currentUser.role!=="admin");
  go("dashboard");
}

async function changePassword(e){
  e.preventDefault();
  const p=document.getElementById("newPassword").value,c=document.getElementById("confirmPassword").value;
  if(p.length<6){toast("A senha precisa ter pelo menos 6 caracteres.",true);return;}
  if(p!==c){toast("As senhas não coincidem.",true);return;}
  try{await updatePassword(auth.currentUser,p);await updateDoc(doc(firestore,"users",currentUser.id),{mustChange:false});currentUser.mustChange=false;toast("Senha alterada com sucesso.");enterApp();}
  catch(err){reportCloudError(err);}
}
async function logout(){try{await signOut(auth);}catch(err){console.error(err);}currentUser=null;db={users:[],subjects:[],posts:[],questions:[],attempts:[],notices:[],library:[]};document.getElementById("loginForm").reset();setScreen("loginScreen");}

function go(p){
  page=p;
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
  document.getElementById("mobilePageTitle").textContent=({dashboard:"Painel inicial",subjects:"Disciplinas e aulas",questions:"Questões e simulados",library:"Biblioteca",teachers:"Corpo docente",performance:"Meu desempenho",editor:"Central de publicação",myPosts:"Minhas publicações",myProfile:"Meu perfil docente",admin:"Painel administrativo",users:"Usuários e matrículas",manageSubjects:"Gerenciar disciplinas",manageContent:"Gerenciar publicações"})[p]||"Academia Águia";
  
  const contentArea = document.getElementById("pageContent");
  contentArea.classList.remove("page-fade");
  void contentArea.offsetWidth; // Força reflow para reiniciar animação
  contentArea.innerHTML=renderPage();
  contentArea.classList.add("page-fade");
  document.getElementById("sidebar").classList.remove("open");
}

function head(title,desc,action=""){return `<div class="page-head"><div><h2>${title}</h2><p>${desc}</p></div>${action}</div>`}
function empty(msg){return `<div class="empty">${msg}</div>`}
function renderPage(){switch(page){case"dashboard":return dashboard();case"subjects":return subjectsPage();case"questions":return questionsPage();case"library":return libraryPage();case"teachers":return teachersPage();case"performance":return performancePage();case"editor":return editorPage();case"myPosts":return myPostsPage();case"myProfile":return profilePage();case"admin":return adminPage();case"users":return usersPage();case"manageSubjects":return manageSubjectsPage();case"manageContent":return manageContentPage();default:return dashboard()}}

function dashboard(){const myAttempts=db.attempts.filter(a=>a.userId===currentUser.id),correct=myAttempts.reduce((n,a)=>n+a.correct,0),total=myAttempts.reduce((n,a)=>n+a.total,0),posts=db.posts.length,qs=db.questions.length,materials=db.library.length+db.posts.filter(p=>p.blocks?.some(b=>b.type==="image"||b.type==="link")).length;return `${head(`Bem-vindo, ${esc(currentUser.name)}`,"Sua central de formação, estudo e preparação.")}<div class="grid"><div class="stat-card"><span class="stat-icon">▤</span><div class="stat-label">Aulas e publicações</div><strong>${posts}</strong><span class="small-text">Conteúdos disponíveis</span></div><div class="stat-card"><span class="stat-icon">☑</span><div class="stat-label">Questões disponíveis</div><strong>${qs}</strong><span class="small-text">Banco de questões</span></div><div class="stat-card"><span class="stat-icon">▣</span><div class="stat-label">Materiais</div><strong>${materials}</strong><span class="small-text">Biblioteca e anexos</span></div><div class="stat-card"><span class="stat-icon">▥</span><div class="stat-label">Meu aproveitamento</div><strong>${total?Math.round(correct/total*100):0}%</strong><span class="small-text">${total} questões respondidas</span></div></div><div class="grid two section-gap"><div class="panel"><h3>Disciplinas</h3><div class="grid two">${db.subjects.slice(0,6).map(s=>`<button class="nav-link" data-subject="${s.id}">▤ <span>${esc(s.name)}</span></button>`).join("")}</div><div class="actions"><button class="btn outline" data-page="subjects">Ver todas as disciplinas</button></div></div><div class="panel"><h3>Avisos da administração</h3>${db.notices.length?db.notices.slice().reverse().slice(0,4).map(n=>`<div class="notice"><b>${esc(n.title)}</b><div>${esc(n.body)}</div><small class="small-text">${esc(n.date)}</small></div>`).join(""):empty("Nenhum aviso publicado até o momento.")}</div></div><div class="panel section-gap"><h3>Atividades recentes</h3>${recentActivity()}</div>`}
function recentActivity(){const items=[...db.posts.map(p=>({label:"Publicação: "+p.title,date:p.date})),...db.attempts.map(a=>({label:"Simulado/questões concluído: "+a.correct+"/"+a.total,date:a.date}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);return items.length?items.map(x=>`<div class="notice">${esc(x.label)} <span class="small-text">• ${esc(x.date)}</span></div>`).join(""):empty("As atividades aparecerão aqui conforme forem realizadas.")}
function subjectFilter(){return `<option value="">Todas as disciplinas</option>`+db.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}
function subjectsPage(){return `${head("Disciplinas e aulas","Explore os conteúdos organizados por matéria.")}<div class="panel"><div class="field"><label>Filtrar disciplina</label><select id="subjectFilter">${subjectFilter()}</select></div><div id="subjectResults">${subjectResults("")}</div></div>`}
function subjectResults(id){const posts=db.posts.filter(p=>!id||p.subjectId===id);return posts.length?posts.slice().reverse().map(postCard).join(""):empty("Ainda não há aulas publicadas nesta disciplina.")}
function postCard(p){return `<article class="item-card"><div class="meta">${esc(subjectName(p.subjectId))} • ${esc(p.date)} • ${esc(p.authorName)}</div><h3>${esc(p.title)}</h3>${(p.blocks||[]).map(renderBlock).join("")}<div class="small-text">Assunto: ${esc(p.topic||"Não informado")}</div></article>`}
function renderBlock(b){if(b.type==="text")return `<div class="block">${esc(b.text).replace(/\n/g,"<br>")}</div>`;if(b.type==="image")return `<figure><img class="post-image" src="${b.data}" alt="${esc(b.caption||b.title||"Imagem da aula")}"><figcaption class="small-text">${esc(b.caption||b.title||"")}</figcaption></figure>`;if(b.type==="link"){let safeUrl=b.url||"#";if(safeUrl&&!/^https?:\/\//i.test(safeUrl))safeUrl="https://"+safeUrl;return `<div class="block"><b>${esc(b.title||"Material externo")}</b><p>${esc(b.description||"")}</p><a href="${esc(safeUrl)}" target="_blank" rel="noopener">Abrir material ↗</a></div>`;}if(b.type==="question"){const q=db.questions.find(x=>x.id===b.questionId);return q?`<div class="block"><b>Questão de fixação</b><p>${esc(q.prompt)}</p><button class="btn secondary" data-page="questions">Resolver questões</button></div>`:""}return ""}
function questionsPage(){const qs=db.questions;return `${head("Questões e simulados","Pratique, confira suas respostas e acompanhe seu resultado.")}<div class="panel"><div class="inline"><div class="field"><label>Disciplina</label><select id="questionSubject">${subjectFilter()}</select></div><div class="field"><label>Modo de correção</label><select id="questionMode"><option value="instant">Correção imediata</option><option value="end">Corrigir ao finalizar</option></select></div></div><div id="questionList">${questionList("")}</div></div>`}
function questionList(sub){const qs=db.questions.filter(q=>!sub||q.subjectId===sub);return qs.length?qs.map(q=>`<div class="item-card"><div class="meta">${esc(subjectName(q.subjectId))} • ${esc(q.topic||"")}</div><b>${esc(q.prompt)}</b><div id="q-${q.id}">${q.options.map((o,i)=>`<label class="choice"><input type="radio" name="ans-${q.id}" value="${i}"> <b>${"ABCD"[i]}.</b> ${esc(o)}</label>`).join("")}<button class="btn primary" data-answer="${q.id}">Responder</button></div><div id="result-${q.id}"></div></div>`).join(""):empty("Nenhuma questão cadastrada ainda.")}

function answerQuestion(id){
  const q=db.questions.find(x=>x.id===id),selected=document.querySelector(`input[name="ans-${id}"]:checked`);
  if(!selected){toast("Selecione uma alternativa.",true);return}
  const ok=Number(selected.value)===q.answer;
  const result=document.getElementById("result-"+id);
  result.innerHTML=`<div class="question-result ${ok?"correct":"incorrect"}"><b>${ok?"Resposta correta!":"Resposta incorreta."}</b><p>Gabarito: ${"ABCD"[q.answer]}. ${esc(q.options[q.answer])}</p><p>${esc(q.explanation||"Sem comentário do professor.")}</p></div>`;
  document.querySelectorAll(`#q-${id} input`).forEach(x=>x.disabled=true);
  const btn = document.querySelector(`#q-${id} button`);
  if(btn) btn.disabled=true;
  
  // Scroll suave até o resultado no celular
  result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  const attempt={id:uid(),userId:currentUser.id,subjectId:q.subjectId,correct:ok?1:0,total:1,date:new Date().toLocaleString("pt-BR")};
  db.attempts.push(attempt);
  saveDoc("attempts",attempt).catch(reportCloudError);
}

function libraryPage(){return `${head("Biblioteca","Materiais complementares, PDFs, imagens e links.")}<div class="panel"><div class="form-grid"><div class="field"><label>Filtrar por disciplina</label><select id="libraryFilter">${subjectFilter()}</select></div><div class="field"><label>Buscar material</label><input id="librarySearch" placeholder="Digite um título ou assunto"></div></div><div id="libraryResults">${libraryResults("","")}</div></div>`}
function libraryResults(sub,term){const list=db.library.filter(x=>(!sub||x.subjectId===sub)&&(!term||(x.title+x.description).toLowerCase().includes(term.toLowerCase())));return list.length?list.map(x=>{let safeUrl=x.url||"#";if(safeUrl&&!/^https?:\/\//i.test(safeUrl))safeUrl="https://"+safeUrl;return `<div class="item-card"><div class="meta">${esc(subjectName(x.subjectId))} • ${esc(x.kind)}</div><h3>${esc(x.title)}</h3><p>${esc(x.description)}</p>${x.url?`<a target="_blank" rel="noopener" href="${esc(safeUrl)}">Abrir material ↗</a>`:""}</div>`}).join(""):empty("Nenhum material encontrado.")}

function teachersPage(){const ts=db.users.filter(u=>u.role==="teacher");return `${head("Corpo docente","Conheça os professores e suas áreas de atuação.")}<div class="grid two">${ts.length?ts.map(t=>{const photo=safeTeacherPhoto(t.photoPath);return `<div class="item-card"><div class="teacher-row">${photo?`<img class="avatar" style="object-fit:cover" src="${esc(photo)}" alt="Foto de ${esc(t.name)}">`:`<div class="avatar" style="display:grid;place-items:center;color:var(--gold);font-size:28px">♙</div>`}<div><h3>${esc(t.name)}</h3><div class="meta">${esc(subjectName(t.subjectId)||t.subject||t.area||"Professor")}</div></div></div><p>${esc(t.bio||"Apresentação não cadastrada.")}</p></div>`}).join(""):empty("Nenhum professor cadastrado.")}</div>`}
function performancePage(){const a=db.attempts.filter(x=>x.userId===currentUser.id),correct=a.reduce((n,x)=>n+x.correct,0),total=a.reduce((n,x)=>n+x.total,0),by={};a.forEach(x=>{const k=subjectName(x.subjectId);by[k]??={c:0,t:0};by[k].c+=x.correct;by[k].t+=x.total});return `${head("Meu desempenho","Acompanhe sua evolução nas atividades realizadas.")}<div class="grid three"><div class="stat-card"><div class="stat-label">Questões respondidas</div><strong>${total}</strong></div><div class="stat-card"><div class="stat-label">Acertos</div><strong>${correct}</strong></div><div class="stat-card"><div class="stat-label">Aproveitamento</div><strong>${total?Math.round(correct/total*100):0}%</strong></div></div><div class="panel section-gap"><h3>Desempenho por disciplina</h3>${Object.keys(by).length?Object.entries(by).map(([k,v])=>`<p>${esc(k)} — ${v.c}/${v.t} (${Math.round(v.c/v.t*100)}%)</p><div class="progress"><span style="width:${v.c/v.t*100}%"></span></div>`).join(""):empty("Responda questões para gerar seu relatório.")}</div><div class="panel section-gap"><h3>Histórico de tentativas</h3>${a.length?a.slice().reverse().map(x=>`<div class="notice">${esc(subjectName(x.subjectId))}: ${x.correct}/${x.total} • ${esc(x.date)}</div>`).join(""):empty("Nenhuma tentativa registrada.")}</div>`}

function editorPage(){return `${head("Central de publicação","Monte aulas com texto, imagens, links e questões em uma mesma sequência.")}<div class="panel"><div class="form-grid"><div class="field"><label>Título da aula *</label><input id="postTitle" placeholder="Ex.: Classes de palavras"></div><div class="field"><label>Disciplina *</label><select id="postSubject" ${currentUser.role==="teacher"?"disabled":""}>${subjectOptionsForCurrentUser()}</select>${currentUser.role==="teacher"?`<small class="small-text">Disciplina definida pela
