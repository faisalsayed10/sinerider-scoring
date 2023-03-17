import express from "express";
import cors from "cors";
import { getScoresByLevel, saveSolution, getAllScores } from "./airtable.js";
import { playLevel, getCharCount } from "./main.js";
import { nanoid } from "nanoid";
import { uploadVideo } from "./video.js";
import { accessSync, constants, rmSync, watchFile } from "fs";

const app = express();

// setup json
app.use(express.json());
// should fix cors issues
app.use(cors());

const port = process.env.PORT ?? 3000;

app.get("/", (req, res) => {
  res.send("SineRider is cool!");
});

app.get("/level/:name", (req, res) => {
  const levelName = req.params.name;

  getScoresByLevel(levelName)
    .then((scores) => res.json({ success: true, scores }))
    .catch((err) => res.json({ success: false, reason: err }));
});

app.get("/all", (req, res) => {
  getAllScores()
    .then((scores) => res.json({ success: true, scores }))
    .catch((err) => res.json({ success: false, reason: err }));
});

// will return either a { success: true, id: <ID_OF_RECORD> } if successfully saved
// or { success: false } if failed
app.post("/score", async (req, res) => {
  // level is a url to the body to the game from the user
  const { level } = req.body;

  let videoName: string = makeVideoName();
  function makeVideoName(): string {
    let name = `${nanoid(8)}.webm`;
    if (name.startsWith("-")) return makeVideoName();
    return name;
  }

  let solution: Solution;
  let videoDetails: VideoDetails;
  playLevel(level, videoName).then((result) => {
    solution = {
      T: result.T,
      expression: result.expression,
      charCount: getCharCount(result.expression),
      playURL: level,
      level: result.level,
      gameplay: ""
    };

    const fileExistCheck = setInterval(() => {
      try {
        accessSync(videoName, constants.F_OK);
        watchFile(videoName, { bigint: false, persistent: true, interval: 1000 }, (curr, prev) => {
          const diff = curr.mtimeMs - prev.mtimeMs;
          if (diff / 1000 >= 2) {
            uploadVideo(videoName)
              .then((result) => (solution.gameplay = result?.uri ?? ""))
              .then(() => {
                saveSolution(solution)
                  .then((data: any) => // string ? { id: string }
                    res.json({ success: true, id: data.id, ...solution })
                  )
                  .then(() => {
                    rmSync(videoName); // remove video after upload
                  })
                  .catch((err) => res.json({ success: false, reason: err }));
              });
          }
        });

        clearInterval(fileExistCheck);
      } catch { }
    }, 3000);

    /*
    setTimeout(() => {
      try {
        accessSync(videoName, constants.F_OK);
        uploadVideo(videoName)
          .then((result) => (solution.gameplay = result.uri))
          .then(() => {
            saveSolution(solution)
              .then((data) =>
                res.json({ success: true, id: data.id, ...solution })
              )
              .catch((err) => res.json({ success: false, reason: err }));
          });

        // clearInterval(fileExistCheck);
      } catch {}
    }, 10000);
    */
    console.log("videoDetails: ", videoDetails);
  });
});

app.listen(port, () =>
  console.log(`Doing some black magic on port ${port}...`)
);