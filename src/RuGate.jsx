import { useState } from 'react';

// Застереження для користувачів із російською мовою системи.
// Відповідь зберігається лише на пристрої (localStorage), у базу нічого не пишемо:
// «Принимаю условия» — додаток працює далі; «Отклонить» — на цьому пристрої доступ закрито.
// Після очищення даних сайту питання з'явиться знову.
const KEY = 'ru:gate';
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const isRussian = () => String((navigator.languages && navigator.languages[0]) || navigator.language || '').toLowerCase().startsWith('ru');

export default function RuGate({ children }) {
  const [answer, setAnswer] = useState(read);
  const save = (v) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* без сховища відповідь діє до перезавантаження */
    }
    setAnswer(v);
  };

  if (answer === 'no') {
    return (
      <main className="ru-gate" lang="ru">
        <div className="ru-card">
          <h1 className="h2">Доступ закрыт</h1>
          <p className="body">Использование приложения на этом устройстве недоступно.</p>
        </div>
      </main>
    );
  }
  if (answer !== 'yes' && isRussian()) {
    return (
      <main className="ru-gate" lang="ru">
        <div className="ru-card" role="alertdialog" aria-describedby="ru-d">
          <p className="body" id="ru-d">Используя это приложение, вы подтверждаете, что не поддерживаете вооруженную агрессию Российской Федерации против суверенных государств, в частности, Украины и Грузии, и не находитесь под действием международных санкций.</p>
          <div className="ru-actions">
            <button type="button" className="btn-primary" onClick={() => save('yes')}>Принимаю условия</button>
            <button type="button" className="btn-ghost" onClick={() => save('no')}>Отклонить</button>
          </div>
        </div>
      </main>
    );
  }
  return children;
}
