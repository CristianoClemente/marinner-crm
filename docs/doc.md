# Z-API — Documentação e Guia de Segurança

## Sumário

1. [Introdução](#introdução)
2. [Segurança — ID e Token](#segurança--id-e-token)
3. [Segurança — Restrição de chamadas por IP](#segurança--restrição-de-chamadas-por-ip)
4. [Segurança — Autenticação de dois fatores](#segurança--autenticação-de-dois-fatores)
5. [Segurança — Token de segurança da conta](#segurança--token-de-segurança-da-conta)

---

## Introdução

### Z-API - Asas para sua imaginação!

Z-API foi desenvolvido por programadores para programadores, por isso prezamos pela simplicidade e objetividade de tudo que nos propomos a fazer. Sendo assim, chega de conversa fiada e **Let's Bora!**

### Mas o que é Z-API?

Z-API é um serviço RESTful que provê uma API que permite que você interaja com seu WhatsApp através de uma API simples e intuitiva, além de webhooks para te avisar sobre interações com seu número.

> **Importante**
> O Z-API reafirma que não é destinada para prática de SPAM e envio de mensagens indesejadas ou qualquer ação que viole os termos de serviço do WhatsApp. Utilize a API com sabedoria, criando funcionalidades que gerem valor aos seus clientes e aos usuários do WhatsApp.



### Quem pode utilizar Z-API?

Não há restrições quanto à utilização, mas geralmente são 2 públicos bem distintos que utilizam nossos serviços:

- Programadores com conhecimentos em APIs RESTful. Se você não é, mas conhece alguém com essas competências, já serve :)
- Utilizadores de soluções de terceiros que permitam integração com Z-API



### Tá bom! Mas o que dá para fazer com ele?

De forma bem direta, tudo que você faz com WhatsApp Web você poderá fazer utilizando nosso serviço. Para isso, basta ler o QR Code do Z-API e utilizar nosso serviço!

### Tecnicamente, como funciona o fluxo de envio?

Para exemplificar, seguem os passos de envio de uma mensagem de texto simples:

1. Você envia via API uma mensagem para o Z-API;
2. O Z-API adiciona em uma fila e te retorna o ID da mensagem;
3. Sua instância processa a fila enviando para o WhatsApp;
4. Seu Webhook de *delivery* é chamado quando a mensagem é processada, te avisando que foi enviada ou que houve falha;
5. Assim que o destinatário receber a mensagem, o Webhook de *message-status* é chamado informando `RECEIVED`;
6. Por fim, quando o destinatário ler a mensagem, o *message-status* é chamado informando `READ`.



### Limites

Iniciamos por este tópico porque é bem comum as pessoas perguntarem sobre quais são os limites de envio com Z-API.

**Nós NÃO TEMOS LIMITE para número de mensagens enviadas!**

Mas é importante entender que você está utilizando uma sessão do WhatsApp Web, então o padrão de utilização precisa ser compatível. Além disso, sempre recomendamos que você leia atentamente as políticas estabelecidas pelo próprio WhatsApp em sua página oficial: [https://www.whatsapp.com/legal](https://www.whatsapp.com/legal).

> **Não armazenamos mensagens!**
> Todas as mensagens enviadas para nossa API serão encaminhadas para uma fila de mensageria e, após o envio, as mesmas são apagadas.

> **Lembre-se**
> O Facebook tem comportamentos diferentes para cada uma das versões do WhatsApp. Nossa API disponibiliza métodos compatíveis com a versão **Web**.

---



## Segurança — ID e Token

*Entenda como funciona a autenticação na Z-API*

### O que é e para que serve?

Para comunicação entre APIs, é necessário estabelecer um protocolo de segurança entre as partes. Sendo assim, toda interação que você fizer com a Z-API vai precisar informar seus atributos de autenticação. Esses atributos vão compor a URL de integração com a Z-API, como no exemplo abaixo:

```
https://api.z-api.io/instances/SUA_INSTANCIA/token/SEU_TOKEN/send-text
```



### Como consigo meu ID e Token?

Após criar sua conta na Z-API e criar uma instância, você terá duas informações que identificam e protegem a comunicação entre sua aplicação e a Z-API.

Para acessar e visualizar os dados da sua instância, basta clicar em **editar** na instância desejada dentro do painel administrativo. Você pode ter múltiplas instâncias, cada uma com credenciais únicas.

> ⚠️ Nunca compartilhe o seu ID e Token com ninguém, pois qualquer pessoa que tiver essas informações poderá enviar mensagens em seu nome. Suas chamadas de API devem ser feitas a partir de um servidor, nunca do frontend, para evitar a exposição dos seus dados de autenticação.

---



## Segurança — Restrição de chamadas por IP

*Restrinja as chamadas feitas à API com base nos endereços IP dos solicitantes*

### Restrição de IPs

O método de segurança de bloqueio por IP introduz uma camada adicional de proteção, permitindo aos usuários restringir as chamadas feitas à API com base nos endereços IP dos solicitantes. Isso significa que você pode controlar quais IPs têm permissão para acessar sua API e quais são bloqueados.

### Ativando o recurso

1. **Faça login na Z-API** — Acesse o painel de controle da Z-API com suas credenciais de administrador.
2. **Navegue até a página de Segurança** — No painel da Z-API, encontre a opção "Segurança" no menu de navegação ou na área de configurações.



### Funcionamento básico

Quando o módulo de Restrição de IPs não está ativado, a API funciona normalmente e permite o acesso de qualquer endereço IP que faça uma solicitação.

### Comportamento de IP não cadastrado

Quando uma solicitação é feita a partir de um endereço IP que não está na lista de IPs permitidos, a API responde com uma mensagem de erro clara:

```json
{
  "error": "[IP da chamada] not allowed"
}
```



### Benefícios do bloqueio por IP


| Benefício                     | Descrição                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| **Controle**                  | Com essa funcionalidade, você tem controle total sobre quem pode acessar a sua API. |
| **Proteção contra ameaças**   | A restrição de IPs ajuda a proteger sua API contra acessos não autorizados.         |
| **Conformidade de segurança** | Para empresas que precisam cumprir regulamentos rigorosos de segurança.             |


---



## Segurança — Autenticação de dois fatores

*Adicione uma camada extra de segurança ao painel da Z-API com autenticação de dois fatores*

### Segurança de dois fatores

A implementação de uma etapa adicional de autenticação, conhecida como autenticação de dois fatores (2FA), é uma camada vital de segurança para proteger o painel da Z-API contra acessos não autorizados e ameaças cibernéticas.

### Ativando o recurso

1. **Acesse o painel da Z-API** — Faça login no painel da Z-API com suas credenciais.
2. **Navegue até a página de Segurança** — No painel da Z-API, encontre a opção "Segurança" no menu de navegação.
3. **Configure a autenticação de dois fatores** — Localize a opção "Autenticação de Dois Fatores" e clique em "Configurar Agora". Um QR Code será gerado para sincronização com aplicativos autenticadores como 1Password, Google Authenticator ou Microsoft Authenticator.



### Funcionamento

Após configurar, siga o fluxo abaixo para autenticar:

1. Abra o aplicativo autenticador no seu celular.
2. Adicione a conta manualmente ou escaneie o QR Code gerado.
3. Vincule a conta da Z-API ao seu dispositivo.
4. Cada vez que você fizer login no painel Z-API, será solicitado que você forneça um código de uso único gerado pelo aplicativo autenticador.
5. O código se regenera a cada poucos segundos e é único por conta.



### Benefícios do uso do 2FA


| Benefício                                  | Descrição                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Proteção adicional**                     | A senha sozinha não é suficiente para acessar o painel. Mesmo que alguém descubra sua senha, ainda precisará do código gerado pelo autenticador. |
| **Prevenção contra acesso não autorizado** | O acesso requer a posse do dispositivo móvel vinculado, dificultando significativamente tentativas de acesso não autorizado.                     |
| **Segurança de dados sensíveis**           | Protege informações confidenciais armazenadas no painel da Z-API com uma camada extra de verificação.                                            |
| **Conformidade com padrões de segurança**  | Atende aos requisitos de segurança exigidos pela indústria e regulamentações vigentes.                                                           |


---



## Segurança — Token de segurança da conta

*Utilize a validação por token para adicionar uma camada de proteção às suas instâncias*

### Token de segurança da conta

Esse método de segurança da Z-API utiliza a validação por token, proporcionando uma camada adicional de proteção para suas instâncias, garantindo que apenas solicitações autorizadas tenham acesso aos seus recursos.

### Ativando o recurso

1. **Faça login na sua conta Z-API** — Acesse o painel da Z-API com suas credenciais.
2. **Navegue até a aba Segurança** — Localize o módulo "Token de Segurança da Conta".
3. **Clique em "Configurar Agora"** — Isso gerará um token, que inicialmente estará desabilitado para evitar interrupções na operação da sua aplicação.



### Funcionamento básico

1. Após a geração do token, ele deve ser incluído no *header* de todas as suas requisições HTTP.
2. O token deve ser passado da seguinte forma:
  - **Atributo:** `Client-Token`
  - **Valor:** `[token]`
3. Após configurar seu ambiente para enviar o token nas requisições, você pode clicar em "Ativar Token".
4. A partir deste momento, todas as instâncias da sua aplicação só aceitarão requisições que contenham o token no header.



### Comportamento do token não cadastrado

Caso uma requisição seja feita sem o token configurado, a API responderá com um erro, conforme o exemplo abaixo:

```json
{
  "error": "null not allowed"
}
```



### Benefícios da validação por token


| Benefício              | Descrição                                                                                                                                          |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Proteção reforçada** | A validação por token garante que apenas requisições autorizadas acessem suas instâncias, adicionando uma barreira extra contra acessos indevidos. |
| **Controle total**     | Você decide quando ativar o token, podendo configurar todo o seu ambiente antes de habilitar a validação, evitando interrupções.                   |


