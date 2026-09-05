////////////////////////////////////////////////////////
//
// Логика презентации: возраст, пролог, досье гонщиков
//
////////////////////////////////////////////////////////

const CATS = [
  { img: "assets/data/cats/00/01.webp", text: "Чёрный Пояс не спит. Он притворяется мёртвым. Заводы давно погасли, но под асфальтом ещё гудит тепло." },
  { img: "assets/data/cats/00/02.webp", text: "В старых тоннелях есть круг, куда не пускают просто так. «Колесница войны». Имя как шутка — пока не увидишь ворота." },
  { img: "assets/data/cats/00/03.webp", text: "Это не чемпионат. Пушки на капоте. Хлам вместо кузова. Финиш — когда ты ещё дышишь, а кто-то уже нет." },
  { img: "assets/data/cats/00/04.webp", text: "Наверху ставят деньги на то, как красиво ты сгоришь. Военные делают вид, что этого места нет." },
  { img: "assets/data/cats/00/05.webp", text: "Арена читает не скорость. Страх. Долги. Того, кого ты не сможешь добить." },
  { img: "assets/data/cats/00/06.webp", text: "Пропуск приходит без отправителя. «Участие добровольное». Ворота закрываются за спиной." },
  { img: "assets/data/cats/00/07.webp", text: "Свет на решётке. Мотор уже тёплый. Садись. Газ. Посмотрим, зачем тебя сюда пустили." }
];

const PILOTS = [
  {
    id: "01",
    name: "Медведь",
    role: "Первая кампания",
    car: "",
    frames: 7,
    card: "Не водит — выпускает нейросеть. Тачки: пушки, мины и чистая ненависть. Военный амбал, которого командование отправило в мясорубку, а машина вытащила обратно.",
    quote: "Приз мне не нужен. Мне нужен доступ к серверу — к именам тех, кто подписал наш приговор."
  },
  {
    id: "02",
    name: "Ерш",
    role: "Сын Башкира",
    car: "",
    frames: 6,
    card: "Бывший курьер. Брони нет принципиально: «хуй догонишь». Либо первый, либо в кювете — но с улыбкой. Зелёный кусок бешенства на болтах и мате.",
    quote: "Я никогда не был сильным. Поэтому научился быть быстрым."
  },
  {
    id: "03",
    name: "Бегемотик",
    role: "Жена Ерша",
    car: "",
    frames: 6,
    card: "Королева шпильки. Вернулась в огонь за человеком и нашла только жетон. Носит розовое, ездит как приговор, курит на пит-стопе.",
    quote: "Я смеюсь не потому, что весело. Я смеюсь, чтобы страх не понял, что победил."
  },
  {
    id: "04",
    name: "Башкир",
    role: "Отец Ерша",
    car: "",
    frames: 7,
    card: "Выживает там, где все взрываются. Машина — танк, обшитый ещё одним танком. Медведь — друг семьи. Арена собрала их четверых в одну клетку.",
    quote: "Я похоронил сына и его жену дважды. Потом эта коробка сказала: они живы."
  },
  {
    id: "06",
    name: "Янот",
    role: "Та, которая не забыла",
    car: "",
    frames: 7,
    card: "Совершеннолетняя любовница Медведя. Он бросил её ради спецоперации и не вернулся. Бричка, дождь, сервер и счёт, который нельзя закрыть молчанием.",
    quote: "Если не вернусь — забудь меня. Иди нахуй. Я тебя уже слишком хорошо знаю, чтобы забыть."
  },
  {
    id: "05",
    name: "Борис Бык",
    role: "Босс сетки",
    car: "",
    frames: 0,
    card: "Не здоровается и не уступает. Идёт в лоб, как будто трасса ему должна. Если он сзади — это не гонка, это родео.",
    quote: "Рога в капот. Не тормозит — бодает."
  }
];

////////////////////////////////////////////////////////
// Возраст 21+
////////////////////////////////////////////////////////

function setupAgeGate() {
  const layer = document.getElementById("age");
  if (!layer) return;
  if (sessionStorage.getItem("kv-age") === "1") {
    layer.classList.remove("is-open");
  }
  document.getElementById("age-yes")?.addEventListener("click", () => {
    sessionStorage.setItem("kv-age", "1");
    layer.classList.remove("is-open");
  });
}

////////////////////////////////////////////////////////
// Пролог Чёрного Пояса
////////////////////////////////////////////////////////

function setupWorld() {
  const art = document.getElementById("world-art");
  const text = document.getElementById("world-text");
  const dots = document.getElementById("world-dots");
  if (!art || !text || !dots) return;

  let index = 0;
  let timer;

  const paint = (next) => {
    index = (next + CATS.length) % CATS.length;
    art.src = CATS[index].img;
    text.textContent = CATS[index].text;
    [...dots.querySelectorAll("button")].forEach((btn, i) => {
      btn.classList.toggle("is-on", i === index);
    });
  };

  CATS.forEach((_, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = String(i + 1).padStart(2, "0");
    btn.addEventListener("click", () => {
      paint(i);
      restart();
    });
    dots.append(btn);
  });

  const restart = () => {
    clearInterval(timer);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    timer = setInterval(() => paint(index + 1), 7000);
  };

  paint(0);
  restart();
}

////////////////////////////////////////////////////////
// Досье
////////////////////////////////////////////////////////

function portraitPath(id) {
  return `assets/data/players/${id}/${id}_Player.webp`;
}

function fullbodyPath(id) {
  return `assets/data/players/${id}/${id}_Player_fullbody.webp`;
}

function renderComics(pilot) {
  const box = document.getElementById("comics");
  if (!box) return;
  box.replaceChildren();
  for (let i = 1; i <= pilot.frames; i += 1) {
    const img = document.createElement("img");
    img.src = `assets/data/players/${pilot.id}/comics/${i}.png`;
    img.alt = `${pilot.name}: кадр ${i}`;
    img.loading = "lazy";
    box.append(img);
  }
}

function openPilot(pilot) {
  const full = document.getElementById("dossier-full");
  const car = document.getElementById("dossier-car");
  document.getElementById("dossier-role").textContent = pilot.role;
  document.getElementById("dossier-name").textContent = pilot.name;
  document.getElementById("dossier-card").textContent = pilot.card;
  document.getElementById("dossier-quote").textContent = pilot.quote;
  full.src = fullbodyPath(pilot.id);
  full.alt = `${pilot.name}, ростовой кадр`;
  if (pilot.car) {
    car.hidden = false;
    car.src = pilot.car;
    car.alt = `Машина: ${pilot.name}`;
  } else {
    car.hidden = true;
    car.removeAttribute("src");
  }
  renderComics(pilot);
  document.querySelectorAll(".pilot").forEach((btn) => {
    btn.classList.toggle("is-on", btn.dataset.id === pilot.id);
  });
}

function setupRoster() {
  const list = document.getElementById("pilot-list");
  if (!list) return;

  PILOTS.forEach((pilot, i) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pilot";
    btn.dataset.id = pilot.id;
    btn.setAttribute("role", "tab");
    const img = document.createElement("img");
    img.src = portraitPath(pilot.id);
    img.alt = "";
    img.width = 54;
    img.height = 54;
    const wrap = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = pilot.name;
    const role = document.createElement("span");
    role.textContent = pilot.role;
    wrap.append(strong, role);
    btn.append(img, wrap);
    btn.addEventListener("click", () => openPilot(pilot));
    list.append(btn);
    if (i === 0) openPilot(pilot);
  });
}

function setupShots() {
  const reel = document.getElementById("shots-reel");
  if (!reel) return;
  CATS.forEach((scene, i) => {
    const figure = document.createElement("figure");
    figure.className = "shot";
    const img = document.createElement("img");
    img.src = scene.img;
    img.alt = `Кадр пролога ${String(i + 1).padStart(2, "0")}`;
    img.loading = "lazy";
    const cap = document.createElement("figcaption");
    const num = document.createElement("span");
    num.textContent = String(i + 1).padStart(2, "0");
    const text = document.createElement("p");
    text.textContent = scene.text;
    cap.append(num, text);
    figure.append(img, cap);
    reel.append(figure);
  });
}

setupAgeGate();
setupWorld();
setupRoster();
setupShots();
