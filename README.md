# Connexus - Seu Hub de Conexão e Organização de Eventos 🔗🗓️

[![Vercel](https://vercel.com/button)](https://web-crm-nine.vercel.app/)

Connexus é uma plataforma web construída com Next.js para facilitar a organização e o acompanhamento de eventos 📅, além de gerenciar seu diretório de contatos 🧑‍🤝‍🧑 e tarefas ✅. Acesse a versão online em [https://web-crm-nine.vercel.app/](https://web-crm-nine.vercel.app/).

## Funcionalidades Atuais (v0.1.3)

* **Dashboard de Eventos Futuros:** Visualize de forma clara os próximos eventos 🗓️.
* **Diretório de Pessoas:** Gerencie seus contatos 🧑‍🤝‍🧑 com informações relevantes.
* **Histórico de Eventos:** Acompanhe os eventos passados ⏪ para referência.
* **Lista de Tarefas:** Organize suas atividades ✅ e mantenha-se produtivo.
* **Autenticação de Usuário:** Segurança 🔒🛡️ e personalização através do Firebase Authentication.
* **Persistência de Dados na Nuvem:** Dados seguros ☁️ e acessíveis utilizando o Firebase.
* **Sugestões de Eventos:** Receba ideias e sugestões ✨ para seus próximos eventos.
* **Compatibilidade com Google API** Os contatos são importados 👤 e eventos são exportados para o Google Agenda 📲 
* **Avaliação de Eventos:** Colete feedback ⭐ e avalie o sucesso de seus eventos.
* **Tarefas com Subníveis:** Divida tarefas complexas em subtarefas gerenciáveis 🪜.
* **Opções Personalizadas** Eventos e Pessoas com novos campos para adicionar ✍️

## Próximas Funcionalidades (v0.1.4 - Em Desenvolvimento 🛠️)

A próxima versão do Connexus trará ainda mais poder para sua organização:

* **Filtros e Pesquisa:** Encontre rapidamente eventos, pessoas e tarefas específicas 🔍.
* **Rotinas:** Organize seu passo a passo 🏹 até atingir suas metas. 🎯

## Tecnologias Utilizadas 💻

* [Next.js](https://nextjs.org/): Framework React para aplicações web com renderização server-side e muito mais.
* [Tailwind CSS](https://tailwindcss.com/): Framework CSS utilitário para estilização rápida e responsiva.
* [Heroicons](https://heroicons.com/): Biblioteca de ícones SVG para interfaces de usuário modernas.
* [Firebase](https://firebase.google.com/): Plataforma de desenvolvimento da Google Cloud para persistência de dados na nuvem (Firestore) e autenticação de usuários (Firebase Authentication).
* [create-next-app](https://create-next-app.dev/): Ferramenta utilizada para inicializar o projeto Next.js.

## Como Executar Localmente (Para Desenvolvedores 🧑‍💻)

Se você deseja executar o Connexus localmente para desenvolvimento ou contribuição, siga estas etapas:

1.  **Clone o repositório (se o código for público):**
    ```bash
    git clone [https://docs.github.com/articles/referencing-and-citing-content](https://docs.github.com/articles/referencing-and-citing-content)
    ```
2.  **Navegue até o diretório do projeto:**
    ```bash
    cd connexus
    ```
3.  **Instale as dependências:**
    ```bash
    npm install
    # ou
    yarn install
    # ou
    pnpm install
    ```
4.  **Configure o Firebase:**
    * Crie um projeto no [Firebase Console](https://console.firebase.google.com/).
    * Configure a autenticação (Firebase Authentication).
    * Crie um banco de dados Firestore.
    * Obtenha as configurações do seu projeto Firebase (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId).
    * Crie um arquivo `.env.local` na raiz do seu projeto e adicione suas configurações do Firebase como variáveis de ambiente:
        ```env
        NEXT_PUBLIC_FIREBASE_API_KEY=SUA_API_KEY
        NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=SEU_AUTH_DOMAIN
        NEXT_PUBLIC_FIREBASE_PROJECT_ID=SEU_PROJECT_ID
        NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=SEU_STORAGE_BUCKET
        NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=SEU_MESSAGING_SENDER_ID
        NEXT_PUBLIC_FIREBASE_APP_ID=SEU_APP_ID
        ```
5.  **Execute o servidor de desenvolvimento:**
    ```bash
    npm run dev
    # ou
    yarn dev
    # ou
    pnpm dev
    ```
6.  **Abra seu navegador em `http://localhost:3000` para visualizar o Connexus.**

## Contribuição 🙏

Contribuições são sempre bem-vindas! Se você tiver ideias para melhorias 💡, encontrou bugs 🐛 ou quer adicionar novas funcionalidades ✨, siga estas etapas:

1.  Faça um **fork** do repositório.
2.  Crie uma **branch** para sua contribuição (`git checkout -b feature/sua-melhoria`).
3.  Faça seus **commits** com mensagens claras e descritivas (`git commit -m 'Adiciona funcionalidade X'`).
4.  Faça **push** para a sua branch (`git push origin feature/sua-melhoria`).
5.  Abra um **Pull Request** para o repositório principal.

## Licença 📄

Este projeto está sob a licença [INSERIR LICENÇA AQUI - Ex: MIT]. Consulte o arquivo `LICENSE` para obter mais detalhes.

## Autores ✍️

* [Seu Nome/Nome da Equipe]([Link para seu GitHub ou outro perfil])

## Status do Projeto 🚦

Em desenvolvimento ativo. A versão `0.1.1` está em andamento com as novas funcionalidades planejadas.

---

Feito com ❤️ usando Next.js, Tailwind CSS e Firebase.