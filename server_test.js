// https://expressjs.com/'
//   const { body } = req;
//   const { text } = body;
// const { text } = req.body;
// console.log(text);
// https://www.together.ai/models
// https://console.groq.com/docs/models
// 1. 텍스트를 받아옴
// 2-1. 이미지를 생성하는 프롬프트
// llama-3-3-70b-free (together) -> 속도 측면
// llama-guard-3-8b (groq) -> 안전하게 (이상한 표현)
// 2-2. 그거에서 프롬프트만 JSON으로 추출
// https://console.groq.com/docs/text-chat
// - Mixtral performs best at generating JSON, followed by Gemma, then Llama
// mixtral-8x7b-32768	(groq) 성능 1위
// + gemma2-9b-it	(groq) 성능 2위 (그리고 나머지...)
// + ... => 무료일경우에는 사용량문제고, 유료라면 단가?
// 2-3. 그걸로 이미지를 생성
// stable-diffusion-xl-base-1.0 (together)
// 3-1. 설명을 생성하는 프롬프트
// llama-3-3-70b-free (together)
// 3-2. 그거에서 프롬프트만 추출
// mixtral-8x7b-32768 (groq)
// 3-3. 그걸로 thinking 사용해서 설명을 작성
// DeepSeek-R1-Distill-Llama-70B-free (together)
// 4. 그 결과를 { image: _, desc: _ }

// https://www.together.ai/models/llama-3-3-70b-free

require("dotenv").config(); // process.env

const express = require("express");
const cors = require("cors");
const axios = require("axios");
const app = express();
const port = 3000;

app.use(cors()); // 미들웨어
// 모두에게 오픈

app.use(express.json());

app.get("/", (req, res) => {
  // res.send("Hello World!");
  res.send("Bye Earth");
});

app.post("/", async (req, res) => {
  const { TOGETHER_API_KEY } = process.env;
  const { GROQ_API_KEY } = process.env;
  // const TOGETHER_URL = "https://api.together.xyz/v1/chat/completions";
  const TOGETHER_BASE_URL = "https://api.together.xyz";
  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const TURBO_MODEL = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free";
  const FLUX_MODEL = "black-forest-labs/FLUX.1-schnell-Free";
  const MIXTRAL_MODEL = "mixtral-8x7b-32768";
  const DEEPSEEK_MODEL = "deepseek-ai/DeepSeek-R1-Distill-Llama-70B-free";

  async function callAI({
    url,
    model,
    text,
    textForImage,
    apiKey,
    max_tokens,
    jsonMode = false,
  }) {
    const payload = {
      model,
    };
    if (text) {
      payload.messages = [
        {
          role: "user",
          content: text,
        },
      ];
    }
    if (max_tokens) {
      payload.max_tokens = max_tokens;
    }
    if (textForImage) {
      payload.prompt = textForImage;
    }
    if (jsonMode) {
      payload.response_format = { type: "json_object" };
    }

    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });
    return response.data;
  }

  // 1. 텍스트를 받아옴
  const { text } = req.body;

  // 2-1. 이미지를 생성하는 프롬프트 -> 추출
  // llama-3-3-70b-free (together) -> 속도 측면
  const prompt = await callAI({
    url: `${TOGETHER_BASE_URL}/v1/chat/completions`,
    apiKey: TOGETHER_API_KEY,
    model: TURBO_MODEL,
    // text,
    text: `${text}의 요구 사항을 바탕으로 칵테일바, 맥주, 술집 등 우리 동네 술집 추천에 어울리는 AI 이미지 생성을 위한 200자 이내의 영어 프롬프트를 작성해줘`,
  }).then((res) => res.choices[0].message.content);

  // 2-2. 프롬프트 추출
  const promptJSON = await callAI({
    url: GROQ_URL,
    apiKey: GROQ_API_KEY,
    model: MIXTRAL_MODEL,
    // text,
    text: `${prompt}에서 AI 이미지 생성을 위해 작성된 200자 이내의 영어 프롬프트를 JSON Object로 prompt라는 key로 JSON string으로 ouput해줘`,
    jsonMode: true,
  }).then((res) => JSON.parse(res.choices[0].message.content).prompt);

  // 2-3. 그걸로 이미지 생성
  const image = await callAI({
    url: `${TOGETHER_BASE_URL}/v1/images/generations`,
    apiKey: TOGETHER_API_KEY,
    model: FLUX_MODEL,
    // text,
    text: promptJSON,
  }).then((res) => res.data[0].url);

  // 3-1. 설명을 생성하는 프롬프트
  // llama-3-3-70b-free (together)
  const prompt2 = await callAI({
    url: `${TOGETHER_BASE_URL}/v1/chat/completions`,
    apiKey: TOGETHER_API_KEY,
    model: TURBO_MODEL,
    // text,
    text: `${text}를 바탕으로 우리 동네 술집(맥주 펍, 칵테일바, 와인바, 일반 음식점 술집 등등) 추천에 어울리는 설명 생성을 위한 200자 이내의 한글 프롬프트를 작성해줘`,
  }).then((res) => res.choices[0].message.content);

  // 3-2. 그거에서 프롬프트만 추출
  // mixtral-8x7b-32768 (groq)
  const promptJSON2 = await callAI({
    url: GROQ_URL,
    apiKey: GROQ_API_KEY,
    model: MIXTRAL_MODEL,
    // text,
    text: `${prompt2}에서 reasoning을 위해 작성된 200자 이내의 한글 프롬프트를 JSON Object로 prompt라는 key로 JSON string으로 ouput해줘`,
    jsonMode: true,
  }).then((res) => JSON.parse(res.choices[0].message.content).prompt);

  // 3-3. 그걸로 thinking 사용해서 설명을 작성
  // DeepSeek-R1-Distill-Llama-70B-free (together)
  const desc = await callAI({
    url: `${TOGETHER_BASE_URL}/v1/chat/completions`,
    apiKey: TOGETHER_API_KEY,
    model: DEEPSEEK_MODEL,
    text: promptJSON2,
    max_tokens: 2048,
  }).then((res) => res.choices[0].message.content.split("</think>")[1]);

  // console.log(image);
  // desc = JSON.stringify(promptJSON);
  res.json({
    image,
    desc,
  });
});

app.listen(port, () => {
  console.log(`app listening on port ${port}`);
});
