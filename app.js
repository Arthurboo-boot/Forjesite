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
import { getFirestore, collection, doc, getDoc, getDocs, getCountFromServer, setDoc, updateDoc, deleteDoc, query, where } from "https://www.gstatic.com/firebasejs/13.3.0/firebase-firestore.js";

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
let db={users:[],subjects:[],posts:[],questions:[],attempts:[],notices:[],library:[],activity:[]};
let dashboardCounts={
  posts:null,
  questions:null,
  library:null
};
let currentSessionId=null, activityHeartbeat=null;

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
let currentUser=null, page="dashboard", draftBlocks=[], draftSubjectId="", selectedTeacherId="", selectedTeacherSubjectId="", selectedTeacherCategory="";

async function readCollection(name){
  const snap=await getDocs(collection(firestore,name));
  return snap.docs.map(d=>({id:d.id,...d.data()}));
}
async function getCollectionCount(name){
  const snap=await getCountFromServer(collection(firestore,name));
  return snap.data().count;
}

const loadedCollections=new Set();

async function loadCollectionOnce(name){
  if(loadedCollections.has(name))return db[name];

  let rows;

  if(name==="attempts" && currentUser.role!=="admin"){
    const snap=await getDocs(
      query(collection(firestore,"attempts"),where("userId","==",currentUser.id))
    );
    rows=snap.docs.map(d=>({id:d.id,...d.data()}));
  }else{
    rows=await readCollection(name);
  }

  db[name]=rows;
  loadedCollections.add(name);
  return rows;
}


async function loadCloudData(){
  loadedCollections.clear();

  await Promise.all([
    loadCollectionOnce("subjects"),
    loadCollectionOnce("attempts"),
    loadCollectionOnce("notices")
  ]);
  const countResults=await Promise.all([
    getCollectionCount("posts").catch(()=>null),
    getCollectionCount("questions").catch(()=>null),
    getCollectionCount("library").catch(()=>null)
  ]);

  dashboardCounts={
    posts:countResults[0],
    questions:countResults[1],
    library:countResults[2]
  };
  if(currentUser.role==="admin" && !db.subjects.length){
    await Promise.all(
      subjectsDefault.map((name,i)=>
        setDoc(doc(firestore,"subjects","s"+i),{name})
      )
    );

    db.subjects=await readCollection("subjects");
    loadedCollections.add("subjects");
  }
}



async function loadPageData(p){
  const tasks=[];

  if(["teachers","users","admin"].includes(p)){
    tasks.push(loadCollectionOnce("users"));
  }

  if(p==="admin"){
    tasks.push(loadCollectionOnce("activity"));
  }

  if(["subjects","myPosts"].includes(p)){
    tasks.push(loadCollectionOnce("posts"));
  }

  if(p==="questions"){
    tasks.push(loadCollectionOnce("questions"));
  }

  if(p==="library"){
    tasks.push(loadCollectionOnce("library"));
  }

  if(["teacherContent","teacherSubject"].includes(p)){
    tasks.push(
      loadCollectionOnce("posts"),
      loadCollectionOnce("questions"),
      loadCollectionOnce("library")
    );
  }

  if(p==="performance"){
    tasks.push(loadCollectionOnce("attempts"));
  }

  await Promise.all(tasks);
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
  return list.map(s=>`<option value="${esc(s.id)}" ${s.id===draftSubjectId?"selected":""}>${esc(s.name)}</option>`).join("");
}
function safeTeacherPhoto(path){
  const value=String(path||"").trim();
  if(!value || !/^assets\/imagens\/[a-zA-Z0-9._-]+\.(png|jpe?g|webp)$/i.test(value)) return "";
  return value;
}
function setScreen(id){["loginScreen","passwordScreen","mainScreen"].forEach(x=>document.getElementById(x).classList.toggle("hidden",x!==id))}


async function registerLoginActivity(profile){
  const now=new Date().toISOString();
  currentSessionId=uid();
  const session={id:currentSessionId,userId:profile.id,userName:profile.name||profile.username||"Usuário",username:profile.username||"",role:profile.role||"student",loginAt:now,lastActivityAt:now,logoutAt:null};
  try{
    await setDoc(doc(firestore,"activity",currentSessionId),session);
    await updateDoc(doc(firestore,"users",profile.id),{lastLoginAt:now});
    profile.lastLoginAt=now;
    if(activityHeartbeat)clearInterval(activityHeartbeat);
    activityHeartbeat=setInterval(()=>{
      if(currentSessionId) updateDoc(doc(firestore,"activity",currentSessionId),{lastActivityAt:new Date().toISOString()}).catch(err=>console.warn("Falha ao atualizar atividade",err));
    },60000);
  }catch(err){console.warn("Registro de movimentação não disponível. Confira as regras do Firestore.",err);currentSessionId=null;}
}
async function registerLogoutActivity(){
  if(activityHeartbeat){clearInterval(activityHeartbeat);activityHeartbeat=null;}
  if(currentSessionId){
    const id=currentSessionId; currentSessionId=null;
    try{await updateDoc(doc(firestore,"activity",id),{logoutAt:new Date().toISOString(),lastActivityAt:new Date().toISOString()});}
    catch(err){console.warn("Não foi possível registrar a saída",err);}
  }
}
function formatDateTime(value){if(!value)return "—";const d=new Date(value);return Number.isNaN(d.getTime())?"—":d.toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});}
function adminActivityPanel(){
  const now=Date.now(),week=7*24*60*60*1000;
  const inactive=db.users.filter(u=>(!u.lastLoginAt?now-new Date(u.createdAt||0).getTime()>=week:now-new Date(u.lastLoginAt).getTime()>=week)).sort((a,b)=>new Date(a.lastLoginAt||a.createdAt||0)-new Date(b.lastLoginAt||b.createdAt||0));
  const recent=db.activity.slice().sort((a,b)=>new Date(b.loginAt)-new Date(a.loginAt)).slice(0,30);
  const days=Array.from({length:7},(_,i)=>{const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-(6-i));const key=d.toLocaleDateString("pt-BR");const count=db.activity.filter(a=>a.loginAt&&new Date(a.loginAt).toLocaleDateString("pt-BR")===key).length;return {label:d.toLocaleDateString("pt-BR",{weekday:"short"}).replace(".",""),count};});
  const max=Math.max(1,...days.map(d=>d.count));
  return `<div class="panel section-gap"><h3>Movimentação da plataforma</h3><p class="small-text">Entradas registradas nos últimos 7 dias</p><div style="display:flex;align-items:end;gap:12px;height:150px;padding:12px 4px;border-bottom:1px solid var(--border,#ddd)">${days.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:end;height:100%;gap:6px"><b style="font-size:12px">${d.count}</b><div title="${d.count} entrada(s)" style="width:100%;max-width:42px;height:${Math.max(4,d.count/max*100)}%;min-height:4px;background:var(--gold,#c6a45c);border-radius:6px 6px 0 0"></div><small>${esc(d.label)}</small></div>`).join("")}</div><div class="grid three section-gap"><div class="stat-card"><div class="stat-label">Acessos registrados</div><strong>${db.activity.length}</strong></div><div class="stat-card"><div class="stat-label">Usuários cadastrados</div><strong>${db.users.length}</strong></div><div class="stat-card"><div class="stat-label">Inativos há 7 dias</div><strong>${inactive.length}</strong></div></div><h3 class="section-gap">Histórico de acessos</h3>${recent.length?`<div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Entrada</th><th>Saída</th></tr></thead><tbody>${recent.map(a=>`<tr><td>${esc(a.userName)}<br><small>${esc(a.username||roleName(a.role))}</small></td><td>${formatDateTime(a.loginAt)}</td><td>${a.logoutAt?formatDateTime(a.logoutAt):`<span class="small-text">Sem saída registrada</span>`}</td></tr>`).join("")}</tbody></table></div>`:empty("Nenhum acesso registrado ainda.")}<h3 class="section-gap">Usuários inativos (7 dias ou mais)</h3>${inactive.length?`<div class="table-wrap"><table><thead><tr><th>Usuário</th><th>Perfil</th><th>Último acesso</th></tr></thead><tbody>${inactive.map(u=>`<tr><td>${esc(u.name||u.username)}</td><td>${roleName(u.role)}</td><td>${u.lastLoginAt?formatDateTime(u.lastLoginAt):"Nunca entrou"}</td></tr>`).join("")}</tbody></table></div>`:empty("Nenhum usuário está inativo há 7 dias ou mais.")}<p class="small-text">Observação: se a pessoa fechar o navegador sem clicar em Sair, o horário de saída não poderá ser confirmado; nesse caso aparecerá como não registrado.</p></div>`;
}
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
    await registerLoginActivity(currentUser);

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
async function logout(){await registerLogoutActivity();try{await signOut(auth);}catch(err){console.error(err);}currentUser=null;db={users:[],subjects:[],posts:[],questions:[],attempts:[],notices:[],library:[],activity:[]};document.getElementById("loginForm").reset();setScreen("loginScreen");}

async function go(p){
  try{
    await loadPageData(p);
  }catch(err){
    reportCloudError(err);
    return;
  }

  page=p;
  document.querySelectorAll(".nav-link").forEach(b=>b.classList.toggle("active",b.dataset.page===p));
  
document.getElementById("mobilePageTitle").textContent=
({
  dashboard:"Painel inicial",
  subjects:"Disciplinas e aulas",
  questions:"Questões e simulados",
  library:"Biblioteca",
  teachers:"Corpo docente",
  teacherOptions:"Área do professor",
  teacherContent:"Biblioteca da disciplina",
  performance:"Meu desempenho",
  editor:"Central de publicação",
  myPosts:"Minhas publicações",
  myProfile:"Meu perfil docente",
  admin:"Painel administrativo",
  users:"Usuários e matrículas",
  manageSubjects:"Gerenciar disciplinas",
  manageContent:"Gerenciar publicações"
})[p]||"Academia Águia";

  const contentArea = document.getElementById("pageContent");
  contentArea.classList.remove("page-fade");
  void contentArea.offsetWidth; // Força reflow para reiniciar animação
  contentArea.innerHTML=renderPage();
  contentArea.classList.add("page-fade");
  document.getElementById("sidebar").classList.remove("open");
}

function head(title,desc,action=""){return `<div class="page-head"><div><h2>${title}</h2><p>${desc}</p></div>${action}</div>`}
function empty(msg){return `<div class="empty">${msg}</div>`}

function renderPage(){switch(page){
case"dashboard":return dashboard();
case"subjects":return subjectsPage();
case"questions":return questionsPage();
case"library":return libraryPage();
case"teachers":return teachersPage();
case"teacherOptions":return teacherOptionsPage();
case"teacherContent":return teacherContentPage();
case"performance":return performancePage();
case"editor":return editorPage();
case"myPosts":return myPostsPage();
case"myProfile":return profilePage();
case"admin":return adminPage();
case"users":return usersPage();
case"manageSubjects":return manageSubjectsPage();
case"manageContent":return manageContentPage();
default:return dashboard();
}}


function dashboard(){
  const myAttempts=db.attempts.filter(a=>a.userId===currentUser.id);
  const correct=myAttempts.reduce((n,a)=>n+a.correct,0);
  const total=myAttempts.reduce((n,a)=>n+a.total,0);
  const posts=dashboardCounts.posts??"—";
  const qs=dashboardCounts.questions??"—";
  const materials=dashboardCounts.library??"—";

  return `${head(`Bem-vindo, ${esc(currentUser.name)}`,"Sua central de formação, estudo e preparação.")}

  <div class="grid">

    <div class="stat-card" data-dashboard-page="subjects" role="button" tabindex="0" style="cursor:pointer">
      <span class="stat-icon">▤</span>
      <div class="stat-label">Aulas e publicações</div>
      <strong>${posts}</strong>
      <span class="small-text">Conteúdos disponíveis</span>
    </div>

    <div class="stat-card" data-dashboard-page="questions" role="button" tabindex="0" style="cursor:pointer">
      <span class="stat-icon">☑</span>
      <div class="stat-label">Questões disponíveis</div>
      <strong>${qs}</strong>
      <span class="small-text">Banco de questões</span>
    </div>

    <div class="stat-card" data-dashboard-page="library" role="button" tabindex="0" style="cursor:pointer">
      <span class="stat-icon">▣</span>
      <div class="stat-label">Biblioteca</div>
      <strong>${materials}</strong>
      <span class="small-text">Materiais cadastrados</span>

    <div class="stat-card" data-dashboard-page="performance" role="button" tabindex="0" style="cursor:pointer">
      <span class="stat-icon">▥</span>
      <div class="stat-label">Meu aproveitamento</div>
      <strong>${total?Math.round(correct/total*100):0}%</strong>
      <span class="small-text">${total} questões respondidas</span>
    </div>

  </div>

  <div class="grid two section-gap">
    <div class="panel">
      <h3>Disciplinas</h3>
      <div class="grid two">
        ${db.subjects.slice(0,6).map(s=>`<button class="nav-link" data-subject="${s.id}">▤ <span>${esc(s.name)}</span></button>`).join("")}
      </div>
      <div class="actions">
        <button class="btn outline" data-page="subjects">Ver todas as disciplinas</button>
      </div>
    </div>

    <div class="panel">
      <h3>Avisos da administração</h3>
    </div>
  </div>

  <div class="panel section-gap">
    <h3>Atividades recentes</h3>
    ${recentActivity()}
  </div>`;
}

function recentActivity(){const items=[...db.posts.map(p=>({label:"Publicação: "+p.title,date:p.date})),...db.attempts.map(a=>({label:"Simulado/questões concluído: "+a.correct+"/"+a.total,date:a.date}))].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,6);return items.length?items.map(x=>`<div class="notice">${esc(x.label)} <span class="small-text">• ${esc(x.date)}</span></div>`).join(""):empty("As atividades aparecerão aqui conforme forem realizadas.")}
function subjectFilter(){return `<option value="">Todas as disciplinas</option>`+db.subjects.map(s=>`<option value="${s.id}">${esc(s.name)}</option>`).join("")}
function subjectsPage(){return `${head("Disciplinas e aulas","Explore os conteúdos organizados por matéria.")}<div class="panel"><div class="field"><label>Filtrar disciplina</label><select id="subjectFilter">${subjectFilter()}</select></div><div id="subjectResults">${subjectResults("")}</div></div>`}
function subjectResults(id){
  const posts=db.posts.filter(p=>!id||p.subjectId===id);
  const adminAction=currentUser?.role==="admin"&&id
    ? `<div class="actions section-gap"><button class="btn primary" data-create-subject-content="${esc(id)}">＋ Adicionar conteúdo nesta disciplina</button></div>`
    : "";
  return adminAction+(posts.length?posts.slice().reverse().map(postCard).join(""):empty("Ainda não há aulas publicadas nesta disciplina."));
}
function postCard(p){return `<article class="item-card"><div class="meta">${esc(subjectName(p.subjectId))} • ${esc(p.date)} • ${esc(p.authorName)}</div><h3>${esc(p.title)}</h3>${(p.blocks||[]).map(renderBlock).join("")}<div class="small-text">Assunto: ${esc(p.topic||"Não informado")}</div></article>`}

function formatMarkedText(value){
  const colors={
    vermelho:"background:#ef4444;color:#fff",
    amarelo:"background:#fde047;color:#202020",
    verde:"background:#22c55e;color:#102015",
    azul:"background:#60a5fa;color:#10243a",
    rosa:"background:#f9a8d4;color:#3b1028",
    roxo:"background:#c4b5fd;color:#28144d"
  };

  const format=(token)=>{
    if(token.startsWith("("))return token.slice(1,-1);
    if(token.startsWith("**"))return `<strong>${token.slice(2,-2)}</strong>`;
    if(token.startsWith("*"))return `<strong>${token.slice(1,-1)}</strong>`;
    if(token.startsWith("__"))return `<u>${token.slice(2,-2)}</u>`;
    if(token.startsWith("_"))return `<em>${token.slice(1,-1)}</em>`;
    if(token.startsWith("~"))return `<del>${token.slice(1,-1)}</del>`;
    return token;
  };

  let source=esc(value||"");

  source=source.replace(
    /(\([^()\n]+\)|\*\*[^*\n]+\*\*|\*[^*\n]+\*|__[^_\n]+__|_[^_\n]+_|~[^~\n]+~)\s*;\s*(vermelho|amarelo|verde|azul|rosa|roxo)\b/gi,
    (match,token,color)=>
      `<mark style="${colors[color.toLowerCase()]};padding:0 .18em;border-radius:.2em">${format(token)}</mark>`
  );

  source=source.replace(
    /\*\*([^*\n]+)\*\*|\*([^*\n]+)\*|__([^_\n]+)__|_([^_\n]+)_|~([^~\n]+)~/g,
    (match,bold,boldSingle,under,italic,strike)=>{
      if(bold!==undefined||boldSingle!==undefined)
        return `<strong>${bold??boldSingle}</strong>`;
      if(under!==undefined)return `<u>${under}</u>`;
      if(italic!==undefined)return `<em>${italic}</em>`;
      if(strike!==undefined)return `<del>${strike}</del>`;
      return match;
    }
  );

  return source.replace(/\n/g,"<br>");
}

function renderBlock(b){
  if(b.type==="text")
    return `<div class="block">${formatMarkedText(b.text)}</div>`;

  if(b.type==="image")
    return `<figure><img class="post-image" src="${b.data}" alt="${esc(b.caption||b.title||"Imagem da aula")}"><figcaption class="small-text">${esc(b.caption||b.title||"")}</figcaption></figure>`;

  if(b.type==="link"){
    let safeUrl=b.url||"#";
    if(safeUrl&&!/^https?:\/\//i.test(safeUrl))safeUrl="https://"+safeUrl;
    return `<div class="block"><b>${esc(b.title||"Material externo")}</b><p>${esc(b.description||"")}</p><a href="${esc(safeUrl)}" target="_blank" rel="noopener">Abrir material ↗</a></div>`;
  }

  if(b.type==="question"){
    const q=db.questions.find(x=>x.id===b.questionId);
    return q?`<div class="block"><b>Questão de fixação</b><p>${esc(q.prompt)}</p><button class="btn secondary" data-page="questions">Resolver questões</button></div>`:"";
  }

  return "";
}


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



function teachersPage(){const ts=db.users.filter(u=>u.role==="teacher");return `${head("Corpo docente","Conheça os professores e suas áreas de atuação.")}<div class="grid two">${ts.length?ts.map(t=>{const photo=safeTeacherPhoto(t.photoPath);return `<div class="item-card" data-open-teacher="${t.id}" role="button" tabindex="0" style="cursor:pointer"><div class="teacher-row">${photo?`<img class="avatar" style="object-fit:cover" src="${esc(photo)}" alt="Foto de ${esc(t.name)}">`:`<div class="avatar" style="display:grid;place-items:center;color:var(--gold);font-size:28px">♙</div>`}<div><h3>${esc(t.name)}</h3><div class="meta">${esc(subjectName(t.subjectId)||t.subject||t.area||"Professor")}</div></div></div><p>${esc(t.bio||"Apresentação não cadastrada.")}</p><span class="small-text">Ver conteúdos →</span></div>`}).join(""):empty("Nenhum professor cadastrado.")}</div>`}


function teacherSubjectPage(){
  const id=selectedTeacherSubjectId;
  const subject=db.subjects.find(s=>s.id===id);

  if(!subject){
    return `${head("Disciplina não encontrada","Não foi possível localizar esta matéria.")}
      <button class="btn outline" data-page="teachers">Voltar ao corpo docente</button>`;
  }

  const posts=db.posts.filter(p=>p.subjectId===id).slice().reverse();
  const questions=db.questions.filter(q=>q.subjectId===id);
  const materials=db.library.filter(m=>m.subjectId===id);

  return `
    ${head(subject.name,"Conteúdos organizados desta disciplina.",
      `<button class="btn outline" data-page="teachers">← Corpo docente</button>`)}

    <div class="panel section-gap">
      <h3>📚 Aulas e conteúdos</h3>
      ${posts.length?posts.map(postCard).join(""):empty("Nenhuma aula publicada nesta disciplina.")}
    </div>

    <div class="panel section-gap">
      <h3>☑ Questões</h3>
      <div id="questionList">
        ${questionList(id)}
      </div>
    </div>

    <div class="panel section-gap">
      <h3>📁 Materiais complementares</h3>
      ${materials.length?libraryResults(id,""):empty("Nenhum material disponível nesta disciplina.")}
    </div>
  `;
}

function teacherOptionsPage(){
  const teacher=db.users.find(u=>u.id===selectedTeacherId);
  if(!teacher)return `${head("Professor não encontrado","")}<button class="btn outline" data-page="teachers">Voltar</button>`;

  const subject=subjectName(selectedTeacherSubjectId)||"Disciplina";

  return `
    ${head(esc(teacher.name),esc(subject),`<button class="btn outline" data-page="teachers">← Corpo docente</button>`)}
    <div class="grid three section-gap">
      <button class="item-card" style="color:#fff" data-teacher-category="aulas">
        <span class="stat-icon">▤</span>
        <h3>Aulas</h3>
        <p>Conteúdos e explicações do professor.</p>
      </button>

      <button class="item-card" style="color:#fff"
      data-teacher-category="questoes">
        <span class="stat-icon">☑</span>
        <h3>Questões</h3>
        <p>Exercícios para praticar.</p>
      </button>

      <button class="item-card"
      style="color:#fff"
      data-teacher-category="materiais">
        <span class="stat-icon">▣</span>
        <h3>Materiais</h3>
        <p>Arquivos, links e materiais complementares.</p>
      </button>
    </div>`;
}

function teacherContentPage(){
  const names={aulas:"Aulas",questoes:"Questões",materiais:"Materiais"};
  return `
    ${head(names[selectedTeacherCategory]||"Conteúdos",
      subjectName(selectedTeacherSubjectId),
      `<button class="btn outline" data-page="teacherOptions">← Voltar</button>`)}
    <div class="panel">
      <div class="field">
        <label>Pesquisar conteúdo</label>
        <input id="teacherContentSearch" placeholder="Digite o título ou assunto...">
      </div>
      <div id="teacherContentResults">
        ${teacherContentResults("")}
      </div>
    </div>`;
}

function teacherContentResults(term){
  const id=selectedTeacherSubjectId;
  const search=term.toLowerCase();

  if(selectedTeacherCategory==="aulas"){
    const list=db.posts.filter(p=>p.subjectId===id&&
      (p.title+" "+(p.topic||"")).toLowerCase().includes(search));
    return list.length?list.slice().reverse().map(postCard).join("")
      :empty("Nenhuma aula encontrada.");
  }

  if(selectedTeacherCategory==="questoes"){
    const list=db.questions.filter(q=>q.subjectId===id&&
      (q.prompt+" "+(q.topic||"")+" "+q.options.join(" ")).toLowerCase().includes(search));

    return list.length?list.map(q=>`
      <div class="item-card">
        <div class="meta">${esc(q.topic||"Questão")}</div>
        <b>${esc(q.prompt)}</b>
        <div id="q-${q.id}">
          ${q.options.map((o,i)=>`
            <label class="choice">
              <input type="radio" name="ans-${q.id}" value="${i}">
              <b>${"ABCD"[i]}.</b> ${esc(o)}
            </label>`).join("")}
          <button class="btn primary" data-answer="${q.id}">Responder</button>
        </div>
        <div id="result-${q.id}"></div>
      </div>`).join(""):empty("Nenhuma questão encontrada.");
  }

  if(selectedTeacherCategory==="materiais"){
    return libraryResults(id,term);
  }

  return empty("Selecione uma categoria.");
}

function performancePage(){const a=db.attempts.filter(x=>x.userId===currentUser.id),correct=a.reduce((n,x)=>n+x.correct,0),total=a.reduce((n,x)=>n+x.total,0),by={};a.forEach(x=>{const k=subjectName(x.subjectId);by[k]??={c:0,t:0};by[k].c+=x.correct;by[k].t+=x.total});return `${head("Meu desempenho","Acompanhe sua evolução nas atividades realizadas.")}<div class="grid three"><div class="stat-card"><div class="stat-label">Questões respondidas</div><strong>${total}</strong></div><div class="stat-card"><div class="stat-label">Acertos</div><strong>${correct}</strong></div><div class="stat-card"><div class="stat-label">Aproveitamento</div><strong>${total?Math.round(correct/total*100):0}%</strong></div></div><div class="panel section-gap"><h3>Desempenho por disciplina</h3>${Object.keys(by).length?Object.entries(by).map(([k,v])=>`<p>${esc(k)} — ${v.c}/${v.t} (${Math.round(v.c/v.t*100)}%)</p><div class="progress"><span style="width:${v.c/v.t*100}%"></span></div>`).join(""):empty("Responda questões para gerar seu relatório.")}</div><div class="panel section-gap"><h3>Histórico de tentativas</h3>${a.length?a.slice().reverse().map(x=>`<div class="notice">${esc(subjectName(x.subjectId))}: ${x.correct}/${x.total} • ${esc(x.date)}</div>`).join(""):empty("Nenhuma tentativa registrada.")}</div>`}

function editorPage(){return `${head("Central de publicação","Monte aulas com texto, imagens, links e questões em uma mesma sequência.")}<div class="panel"><div class="form-grid"><div class="field"><label>Título da aula *</label><input id="postTitle" placeholder="Ex.: Classes de palavras"></div><div class="field"><label>Disciplina *</label><select id="postSubject" ${currentUser.role==="teacher"?"disabled":""}>${subjectOptionsForCurrentUser()}</select>${currentUser.role==="teacher"?`<small class="small-text">Disciplina definida pela administração: ${esc(subjectName(teacherSubjectId()))}</small>`:""}</div></div><div class="field"><label>Assunto / tópico</label><input id="postTopic" placeholder="Ex.: Substantivo"></div><div class="tabs"><button class="tab" data-addblock="text">＋ Texto</button><button class="tab" data-addblock="image">＋ Imagem</button><button class="tab" data-addblock="link">＋ Link</button><button class="tab" data-addblock="question">＋ Questão existente</button></div><div id="blockEditor">${draftBlocks.length?draftBlocks.map((b,i)=>blockEditor(b,i)).join(""):empty("Adicione os blocos que formarão sua aula.")}</div><div class="actions"><button class="btn primary" id="publishPost">Publicar aula</button><button class="btn outline" id="clearDraft">Limpar editor</button></div><p class="small-text">As publicações ficam visíveis aos alunos imediatamente. O administrador pode revisá-las e removê-las.</p></div><div class="panel section-gap"><h3>Cadastro rápido de questão</h3>${questionForm(false)}</div><div class="panel section-gap"><h3>Adicionar material à biblioteca</h3>${libraryForm()}</div>`}
function blockEditor(b,i){let body="";if(b.type==="text")body=`<textarea data-blockfield="text" data-index="${i}" placeholder="Escreva o conteúdo da aula...">${esc(b.text||"")}</textarea>`;if(b.type==="image")body=`<input type="file" accept="image/*" data-imageblock="${i}"><input data-blockfield="caption" data-index="${i}" placeholder="Legenda da imagem" value="${esc(b.caption||"")}">${b.data?`<img class="file-preview" src="${b.data}">`:""}`;if(b.type==="link")body=`<input data-blockfield="title" data-index="${i}" placeholder="Título do link" value="${esc(b.title||"")}"><input data-blockfield="url" data-index="${i}" placeholder="https://..." value="${esc(b.url||"")}"><textarea data-blockfield="description" data-index="${i}" placeholder="Descrição">${esc(b.description||"")}</textarea>`;if(b.type==="question")body=`<select data-blockfield="questionId" data-index="${i}"><option value="">Selecione uma questão</option>${db.questions.map(q=>`<option value="${q.id}" ${q.id===b.questionId?"selected":""}>${esc(q.prompt.slice(0,80))}</option>`).join("")}</select>`;return `<div class="block"><div class="block-toolbar"><b>BLOCO ${i+1} — ${b.type.toUpperCase()}</b><div><button class="btn outline" data-move="${i}" data-dir="-1">↑</button> <button class="btn outline" data-move="${i}" data-dir="1">↓</button> <button class="btn danger" data-removeblock="${i}">Remover</button></div></div>${body}</div>`}
function questionForm(admin){return `<div class="field"><label>Disciplina</label><select id="qSubject" ${currentUser.role==="teacher"?"disabled":""}>${subjectOptionsForCurrentUser()}</select></div><div class="field"><label>Assunto</label><input id="qTopic" placeholder="Assunto da questão"></div><div class="field"><label>Enunciado *</label><textarea id="qPrompt" placeholder="Digite o enunciado"></textarea></div><div class="form-grid">${["A","B","C","D"].map((x,i)=>`<div class="field"><label>Alternativa ${x} *</label><input id="qOpt${i}" placeholder="Alternativa ${x}"></div>`).join("")}</div><div class="form-grid"><div class="field"><label>Gabarito</label><select id="qAnswer"><option value="0">A</option><option value="1">B</option><option value="2">C</option><option value="3">D</option></select></div><div class="field"><label>Comentário do professor</label><input id="qExplanation" placeholder="Explique a resposta"></div></div><button class="btn secondary" id="saveQuestion">Cadastrar questão</button>`}
function libraryForm(){return `<div class="form-grid"><div class="field"><label>Título</label><input id="libTitle"></div><div class="field"><label>Disciplina</label><select id="libSubject" ${currentUser.role==="teacher"?"disabled":""}>${subjectOptionsForCurrentUser()}</select></div></div><div class="form-grid"><div class="field"><label>Tipo</label><select id="libKind"><option>PDF</option><option>Imagem</option><option>Link</option><option>Apostila</option><option>Resumo</option><option>Material complementar</option></select></div><div class="field"><label>Endereço URL (quando aplicável)</label><input id="libUrl" placeholder="https://..."></div></div><div class="field"><label>Descrição</label><textarea id="libDescription"></textarea></div><button class="btn secondary" id="saveLibrary">Salvar material</button>`}
function myPostsPage(){const list=db.posts.filter(p=>p.authorId===currentUser.id);return `${head("Minhas publicações","Consulte, edite ou exclua os conteúdos que você publicou.")}${list.length?list.slice().reverse().map(p=>`<div class="item-card"><div class="meta">${esc(subjectName(p.subjectId))} • ${esc(p.date)}</div><h3>${esc(p.title)}</h3><p>${esc(p.topic||"")}</p><div class="actions"><button class="btn outline" data-editpost="${p.id}">Editar</button><button class="btn danger" data-deletepost="${p.id}">Excluir</button></div></div>`).join(""):empty("Você ainda não publicou aulas.")}`}
function profilePage(){return `${head("Meu perfil docente","Atualize sua apresentação no corpo docente.")}<div class="panel"><form id="profileForm"><div class="field"><label>Nome de exibição</label><input id="profileName" value="${esc(currentUser.name)}" required></div><div class="field"><label>Disciplina principal</label><input value="${esc(subjectName(currentUser.subjectId)||currentUser.subject||"Não definida")}" disabled></div><div class="field"><label>Área de atuação</label><input id="profileArea" value="${esc(currentUser.area||"")}"></div><div class="field"><label>Apresentação</label><textarea id="profileBio">${esc(currentUser.bio||"")}</textarea></div><p class="small-text">A disciplina e a foto do perfil são definidas pela administração.</p><button class="btn primary">Salvar perfil</button></form></div>`}
function adminPage(){const teachers=db.users.filter(u=>u.role==="teacher").length,students=db.users.filter(u=>u.role==="student").length;return `${head("Painel administrativo","Visão geral e ferramentas de gestão da Academia Águia.")}<div class="grid"><div class="stat-card"><div class="stat-label">Alunos cadastrados</div><strong>${students}</strong></div><div class="stat-card"><div class="stat-label">Professores</div><strong>${teachers}</strong></div><div class="stat-card"><div class="stat-label">Publicações</div><strong>${db.posts.length}</strong></div><div class="stat-card"><div class="stat-label">Questões</div><strong>${db.questions.length}</strong></div></div><div class="grid two section-gap"><div class="panel"><h3>Publicar aviso</h3><div class="field"><label>Título</label><input id="noticeTitle"></div><div class="field"><label>Mensagem</label><textarea id="noticeBody"></textarea></div><button class="btn primary" id="publishNotice">Publicar aviso</button></div><div class="panel"><h3>Atividade recente</h3>${recentActivity()}</div></div><div class="panel section-gap"><h3>Estado do armazenamento</h3><p class="muted">010</p><button class="btn outline" id="exportData">Exportar cópia dos dados (JSON)</button></div>${adminActivityPanel()}`}
function usersPage(){return `${head("Usuários e matrículas","Cadastre contas e forneça uma senha provisória para o primeiro acesso.")}<div class="panel"><h3>Cadastro em lote de alunos</h3><p class="small-text">Uma pessoa por linha, neste formato: Nome; matrícula; senha. Exemplo: Ana Souza; 1020; Senha123</p><div class="field"><label>Lista de alunos</label><textarea id="bulkUsers" rows="6" placeholder="Ana Souza; 1020; Senha123
João Lima; 1021; Senha123"></textarea></div><button class="btn primary" id="createBulkUsers">Cadastrar todos</button><p class="small-text">O cadastro em lote cria contas de alunos. Professores e administradores continuam sendo cadastrados individualmente.</p></div><div class="panel section-gap"><h3>Novo usuário</h3><div class="form-grid"><div class="field"><label>Nome completo</label><input id="userName"></div><div class="field"><label>Usuário / matrícula</label><input id="userLogin"></div><div class="field"><label>Perfil</label><select id="userRole"><option value="student">Aluno</option><option value="teacher">Professor</option><option value="admin">Administrador</option></select></div><div class="field"><label>Senha provisória</label><input id="userTempPass" value="Aguila@2026"></div></div><div id="teacherFields" class="panel section-gap hidden"><h3>Dados do professor</h3><div class="field"><label>Disciplina que ficará sob responsabilidade do professor *</label><select id="userSubject"><option value="">Selecione a disciplina</option>${db.subjects.map(s=>`<option value="${esc(s.id)}">${esc(s.name)}</option>`).join("")}</select></div><div class="field"><label>Caminho da foto (opcional)</label><input id="userPhotoPath" placeholder="assets/imagens/professor-portugues.jpg"><small class="small-text">Coloque a imagem na pasta assets/imagens e informe o nome exato do arquivo.</small></div></div><button class="btn primary" id="createUser">Criar cadastro</button><p class="small-text">A conta será obrigada a trocar a senha no primeiro login.</p></div><div class="panel section-gap"><h3>Contas cadastradas</h3><div class="table-wrap"><table><thead><tr><th>Nome</th><th>Usuário</th><th>Perfil</th><th>Disciplina</th><th>Ação</th></tr></thead><tbody>${db.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.username)}</td><td>${roleName(u.role)}</td><td>${u.role==="teacher"?esc(subjectName(u.subjectId)||u.subject||"Não definida"):"—"}</td><td><button class="btn danger" data-deleteuser="${u.id}">Excluir</button></td></tr>`).join("")}</tbody></table></div></div>`}
function manageSubjectsPage(){return `${head("Gerenciar disciplinas","Adicione ou remova matérias disponíveis na plataforma.")}<div class="panel"><div class="inline"><input id="newSubject" placeholder="Nome da nova disciplina"><button class="btn primary" id="addSubject">Adicionar</button></div><div class="section-gap">${db.subjects.map(s=>`<div class="notice inline"><span>${esc(s.name)}</span><button class="btn danger" data-deletesubject="${s.id}">Excluir</button></div>`).join("")}</div></div>`}
function manageContentPage(){return `${head("Gerenciar publicações","O administrador pode revisar e remover qualquer publicação.")}${db.posts.length?db.posts.slice().reverse().map(p=>`<div class="item-card"><div class="meta">${esc(p.authorName)} • ${esc(subjectName(p.subjectId))}</div><h3>${esc(p.title)}</h3><p>${esc(p.topic||"")}</p><button class="btn danger" data-deletepost="${p.id}">Remover publicação</button></div>`).join(""):empty("Ainda não existem publicações.")}`}

function addBlock(type){draftBlocks.push({type});go("editor")}
function updateBlock(i,k,v){if(draftBlocks[i])draftBlocks[i][k]=v}
function saveQuestion(){const prompt=document.getElementById("qPrompt").value.trim(),opts=[0,1,2,3].map(i=>document.getElementById("qOpt"+i).value.trim()),subjectId=currentUser.role==="teacher"?teacherSubjectId():document.getElementById("qSubject").value;if(!subjectId){toast("Selecione uma disciplina.",true);return}if(!prompt||opts.some(x=>!x)){toast("Preencha enunciado e as quatro alternativas.",true);return}const item={id:uid(),subjectId,topic:document.getElementById("qTopic").value,prompt,options:opts,answer:Number(document.getElementById("qAnswer").value),explanation:document.getElementById("qExplanation").value,authorId:currentUser.id};saveDoc("questions",item).then(()=>{db.questions.push(item);toast("Questão cadastrada.");go("editor")}).catch(reportCloudError)}
function publishPost(){const title=document.getElementById("postTitle").value.trim(),subjectId=currentUser.role==="teacher"?teacherSubjectId():document.getElementById("postSubject").value;if(!title||!subjectId){toast("Informe o título e a disciplina.",true);return}if(!draftBlocks.length){toast("Adicione pelo menos um bloco à aula.",true);return}for(const b of draftBlocks){if(b.type==="text"&&!b.text?.trim()){toast("Há um bloco de texto vazio.",true);return}if(b.type==="link"&&(!b.url)){toast("Informe a URL do link.",true);return}if(b.type==="question"&&!b.questionId){toast("Selecione a questão do bloco.",true);return}}const item={id:uid(),title,subjectId,topic:document.getElementById("postTopic").value,blocks:JSON.parse(JSON.stringify(draftBlocks)),authorId:currentUser.id,authorName:currentUser.name,date:new Date().toLocaleString("pt-BR")};saveDoc("posts",item).then(()=>{db.posts.push(item);draftBlocks=[];draftSubjectId="";toast("Aula publicada para os alunos.");go("myPosts")}).catch(reportCloudError)}
function saveLibrary(){const title=document.getElementById("libTitle").value.trim(),subjectId=currentUser.role==="teacher"?teacherSubjectId():document.getElementById("libSubject").value;if(!title||!subjectId){toast("Informe o título e a disciplina.",true);return}const item={id:uid(),title,subjectId,kind:document.getElementById("libKind").value,url:document.getElementById("libUrl").value,description:document.getElementById("libDescription").value,authorId:currentUser.id};saveDoc("library",item).then(()=>{db.library.push(item);toast("Material salvo na biblioteca.");go("library")}).catch(reportCloudError)}
async function saveProfile(e){
  e.preventDefault();
  const patch={name:document.getElementById("profileName").value.trim(),area:document.getElementById("profileArea").value,bio:document.getElementById("profileBio").value};
  try{await updateDoc(doc(firestore,"users",currentUser.id),patch);Object.assign(currentUser,patch);const i=db.users.findIndex(u=>u.id===currentUser.id);if(i>=0)db.users[i]={...db.users[i],...patch};toast("Perfil atualizado.");enterApp();go("myProfile");}
  catch(err){reportCloudError(err);}
}
function fileToData(file,cb){if(!file)return;if(file.size>500000){toast("Imagem muito grande para o Firestore. Escolha uma imagem de até 500 KB.",true);return}const r=new FileReader();r.onload=()=>cb(r.result);r.readAsDataURL(file)}
async function createBulkUsers(){
  const raw=document.getElementById("bulkUsers").value.trim();
  if(!raw){toast("Cole a lista de alunos primeiro.",true);return;}
  const rows=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map((line,i)=>{const parts=line.split(/[;|,]/).map(x=>x.trim());return {line:i+1,name:parts[0]||"",username:(parts[1]||"").toLowerCase(),password:parts[2]||""};});
  const invalid=rows.filter(x=>!x.name||!x.username||x.password.length<6);
  if(invalid.length){toast(`Confira as linhas ${invalid.map(x=>x.line).join(", ")}: informe nome, matrícula e senha de 6 caracteres.`,true);return;}
  const seen=new Set();for(const row of rows){if(seen.has(row.username)||db.users.some(u=>(u.username||"").toLowerCase()===row.username)){toast(`Matrícula repetida ou já cadastrada: ${row.username}`,true);return;}seen.add(row.username);}
  const button=document.getElementById("createBulkUsers");button.disabled=true;button.textContent="Cadastrando...";
  let created=0,failed=[];
  try{
    for(const row of rows){
      try{
        const cred=await createUserWithEmailAndPassword(secondaryAuth,authEmail(row.username),row.password);
        const profile={username:row.username,name:row.name,role:"student",mustChange:true,createdAt:new Date().toISOString()};
        await setDoc(doc(firestore,"users",cred.user.uid),profile);
        db.users.push({id:cred.user.uid,...profile});created++;
        await signOut(secondaryAuth);
      }catch(err){try{await signOut(secondaryAuth);}catch(_){}failed.push(`${row.username}: ${err.code||err.message}`);}
    }
  }finally{button.disabled=false;button.textContent="Cadastrar todos";}
  if(failed.length){alert(`Concluído: ${created} cadastro(s).\nFalharam ${failed.length}:\n${failed.join("\n")}`);}else{toast(`${created} aluno(s) cadastrado(s) com sucesso.`);document.getElementById("bulkUsers").value="";}
  go("users");
}
async function createUser(){
  const name=document.getElementById("userName").value.trim(),username=document.getElementById("userLogin").value.trim().toLowerCase(),password=document.getElementById("userTempPass").value,role=document.getElementById("userRole").value;
  const subjectId=role==="teacher"?document.getElementById("userSubject").value:"";
  const photoPath=role==="teacher"?document.getElementById("userPhotoPath").value.trim():"";
  if(!name||!username||password.length<6){toast("Preencha os campos e use senha com 6 caracteres ou mais.",true);return;}
  if(role==="teacher"&&!subjectId){toast("Escolha a disciplina do professor.",true);return;}
  if(role==="teacher"&&photoPath&&!safeTeacherPhoto(photoPath)){toast("Use um caminho válido dentro de assets/imagens, por exemplo assets/imagens/professor-portugues.jpg.",true);return;}
  if(db.users.some(u=>u.username.toLowerCase()===username)){toast("Esse usuário/matrícula já existe.",true);return;}
  try{const cred=await createUserWithEmailAndPassword(secondaryAuth,authEmail(username),password);const assigned=db.subjects.find(s=>s.id===subjectId);const profile={username,name,role,mustChange:true,createdAt:new Date().toISOString(),...(role==="teacher"?{subjectId,subject:assigned?.name||"",photoPath}: {})};await setDoc(doc(firestore,"users",cred.user.uid),profile);await signOut(secondaryAuth);db.users.push({id:cred.user.uid,...profile});toast("Usuário criado. Entregue a matrícula e a senha provisória.");go("users");}
  catch(err){try{await signOut(secondaryAuth);}catch(_){}reportCloudError(err);}
}

function bindPage(){
  document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>go(b.dataset.page));
  document.querySelectorAll("[data-subject]").forEach(b=>b.addEventListener("click",()=>{go("subjects");setTimeout(()=>{ $("subjectFilter").value=b.dataset.subject;$("subjectResults").innerHTML=subjectResults(b.dataset.subject)},0)}));
  
  const $=id=>document.getElementById(id);
  
document.querySelectorAll("[data-open-teacher]").forEach(card=>{
  card.onclick=()=>{
    const teacher=db.users.find(u=>u.id===card.dataset.openTeacher);
    if(!teacher)return;

    selectedTeacherId=teacher.id;
    selectedTeacherSubjectId=teacher.subjectId;
    go("teacherOptions");
  };
});

document.querySelectorAll("[data-teacher-category]").forEach(button=>{
  button.onclick=()=>{
    selectedTeacherCategory=button.dataset.teacherCategory;
    go("teacherContent");
  };
});

if($("teacherContentSearch")){
  $("teacherContentSearch").oninput=e=>{
    $("teacherContentResults").innerHTML=teacherContentResults(e.target.value);
  };
}
  
document.querySelectorAll("[data-open-teacher-subject]").forEach(card=>{
  const openSubject=()=>{
    const id=card.dataset.openTeacherSubject;

    if(!id){
      toast("Esta disciplina não está vinculada ao professor.",true);
      return;
    }

    selectedTeacherSubjectId=id;
    go("teacherSubject");
  };

  card.onclick=openSubject;

  card.onkeydown=e=>{
    if(e.key==="Enter" || e.key===" "){
      e.preventDefault();
      openSubject();
    }
  };
});

  if($("subjectFilter"))$("subjectFilter").onchange=e=>$("subjectResults").innerHTML=subjectResults(e.target.value);
  if($("questionSubject"))$("questionSubject").onchange=e=>$("questionList").innerHTML=questionList(e.target.value);
  
document.querySelectorAll("[data-dashboard-page]").forEach(card=>{
  card.onclick=()=>go(card.dataset.dashboardPage);

  card.onkeydown=e=>{
    if(e.key==="Enter" || e.key===" "){
      e.preventDefault();
      go(card.dataset.dashboardPage);
    }
  };
});

  
const subjectResultsContainer=$("subjectResults");

if(subjectResultsContainer){
  subjectResultsContainer.onclick=e=>{
    const button=e.target.closest("[data-create-subject-content]");
    if(!button)return;

    if(currentUser?.role!=="admin"){
      toast("Recurso disponível somente para administradores.",true);
      return;
    }

    draftSubjectId=button.dataset.createSubjectContent;
    draftBlocks=[];
    go("editor");
    draftSubjectId="";
  };
}

  
  // Delegação unificada para responder questões com segurança
  const qListContainer = $("questionList");
  if(qListContainer){
    qListContainer.onclick = function(e) {
      const btn = e.target.closest("[data-answer]");
      if(btn) answerQuestion(btn.dataset.answer);
    };
  }

  if($("libraryFilter"))$("libraryFilter").onchange=()=> $("libraryResults").innerHTML=libraryResults($("libraryFilter").value,$("librarySearch").value);
  if($("librarySearch"))$("librarySearch").oninput=()=> $("libraryResults").innerHTML=libraryResults($("libraryFilter").value,$("librarySearch").value);

  document.querySelectorAll("[data-addblock]").forEach(b=>b.onclick=()=>addBlock(b.dataset.addblock));
  document.querySelectorAll("[data-blockfield]").forEach(el=>el.oninput=()=>updateBlock(Number(el.dataset.index),el.dataset.blockfield,el.value));
  document.querySelectorAll("[data-removeblock]").forEach(b=>b.onclick=()=>{draftBlocks.splice(Number(b.dataset.removeblock),1);go("editor")});
  document.querySelectorAll("[data-move]").forEach(b=>b.onclick=()=>{const i=Number(b.dataset.move),j=i+Number(b.dataset.dir);if(j>=0&&j<draftBlocks.length){[draftBlocks[i],draftBlocks[j]]=[draftBlocks[j],draftBlocks[i]];go("editor")}});
  document.querySelectorAll("[data-imageblock]").forEach(el=>el.onchange=()=>fileToData(el.files[0],data=>{draftBlocks[Number(el.dataset.imageblock)].data=data;go("editor")}));

  if($("publishPost"))$("publishPost").onclick=publishPost;
  if($("clearDraft"))$("clearDraft").onclick=()=>{draftBlocks=[];draftSubjectId="";go("editor")};
  if($("saveQuestion"))$("saveQuestion").onclick=saveQuestion;
  if($("saveLibrary"))$("saveLibrary").onclick=saveLibrary;
  if($("profileForm"))$("profileForm").onsubmit=saveProfile;
  if($("createUser"))$("createUser").onclick=createUser;
  if($("createBulkUsers"))$("createBulkUsers").onclick=createBulkUsers;
  if($("userRole")){
    const toggleTeacherFields=()=>$("teacherFields")?.classList.toggle("hidden",$("userRole").value!=="teacher");
    $("userRole").onchange=toggleTeacherFields;
    toggleTeacherFields();
  }

  document.querySelectorAll("[data-deleteuser]").forEach(b=>b.onclick=async()=>{if(b.dataset.deleteuser===currentUser.id){toast("Não é possível excluir a conta em uso.",true);return}if(confirm("Remover o perfil e o acesso à plataforma deste usuário?")){try{await removeDoc("users",b.dataset.deleteuser);db.users=db.users.filter(u=>u.id!==b.dataset.deleteuser);toast("Perfil removido. A conta de autenticação permanece no Firebase, mas sem acesso ao sistema.");go("users");}catch(err){reportCloudError(err);}}});
  if($("addSubject"))$("addSubject").onclick=()=>{const n=$("newSubject").value.trim();if(!n){toast("Digite o nome da disciplina.",true);return}if(db.subjects.some(s=>s.name.toLowerCase()===n.toLowerCase())){toast("Disciplina já cadastrada.",true);return}const item={id:uid(),name:n};saveDoc("subjects",item).then(()=>{db.subjects.push(item);go("manageSubjects")}).catch(reportCloudError)};
  document.querySelectorAll("[data-deletesubject]").forEach(b=>b.onclick=()=>{if(confirm("Remover esta disciplina? Conteúdos já publicados serão mantidos.")){removeDoc("subjects",b.dataset.deletesubject).then(()=>{db.subjects=db.subjects.filter(s=>s.id!==b.dataset.deletesubject);go("manageSubjects")}).catch(reportCloudError)}});
  document.querySelectorAll("[data-deletepost]").forEach(b=>b.onclick=()=>{if(confirm("Excluir esta publicação?")){removeDoc("posts",b.dataset.deletepost).then(()=>{db.posts=db.posts.filter(p=>p.id!==b.dataset.deletepost);go(page)}).catch(reportCloudError)}});
  document.querySelectorAll("[data-editpost]").forEach(b=>b.onclick=()=>{
    const p=db.posts.find(x=>x.id===b.dataset.editpost);if(!p)return;
    draftBlocks=JSON.parse(JSON.stringify(p.blocks||[]));go("editor");
    setTimeout(()=>{
      $("postTitle").value=p.title;$("postSubject").value=p.subjectId;$("postTopic").value=p.topic||"";
      const btn=$("publishPost");btn.textContent="Salvar alterações";
      btn.onclick=()=>{
        p.title=$("postTitle").value.trim();
        p.subjectId=currentUser.role==="teacher"?teacherSubjectId():$("postSubject").value;
        p.topic=$("postTopic").value;p.blocks=JSON.parse(JSON.stringify(draftBlocks));
        saveDoc("posts",p).then(()=>{draftBlocks=[];toast("Publicação atualizada.");go("myPosts");}).catch(reportCloudError);
      };
    },0);
  });
  if($("publishNotice"))$("publishNotice").onclick=()=>{const title=$("noticeTitle").value.trim(),body=$("noticeBody").value.trim();if(!title||!body){toast("Preencha título e mensagem.",true);return}const item={id:uid(),title,body,date:new Date().toLocaleString("pt-BR")};saveDoc("notices",item).then(()=>{db.notices.push(item);toast("Aviso publicado.");go("admin")}).catch(reportCloudError)};
  if($("exportData"))$("exportData").onclick=()=>{const blob=new Blob([JSON.stringify(db,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="academia-aguila-backup.json";a.click();URL.revokeObjectURL(a.href)};
}

const originalRender=renderPage;
renderPage=function(){const html=originalRender();setTimeout(bindPage,0);return html};
if(localStorage.getItem("aguila_theme")==="light")document.body.classList.add("light");

document.getElementById("loginForm").addEventListener("submit",login);
document.getElementById("passwordForm").addEventListener("submit",changePassword);
document.getElementById("logoutBtn").addEventListener("click",logout);
document.getElementById("themeToggle").addEventListener("click",()=>{document.body.classList.toggle("light");localStorage.setItem("aguila_theme",document.body.classList.contains("light")?"light":"dark")});
document.getElementById("menuToggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
                                                                                                                                                                                                                        
