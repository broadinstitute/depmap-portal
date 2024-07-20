import * as React from "react";
import { useState } from "react";
import ChunkedFileUploader from "../components/ChunkedFileUploader";
import { UploadFileResponse } from "@depmap/types";

export default {
  title: "Components/ChunkedFileUploader",
  component: ChunkedFileUploader,
};

let counter = 0;

export function FileUploaderStory() {
  const [fileIds, setFileIds] = useState<Array<string> | null>([]);
  const [hash, setHash] = useState<string | null>("");

  async function uploadFile(): Promise<UploadFileResponse> {
    counter++;
    console.log(counter);
    // Uncomment below to test error in uploading for relatively large file that can be broken to at least 2 chunks
    // if (counter == 2) {
    //   throw new Error('Fake error');
    // }
    return { file_id: `id-${counter}` };
  }

  return (
    <>
      <div>
        <ChunkedFileUploader
          uploadFile={uploadFile}
          forwardFileIdsAndHash={(fileIds, hash: string) => {
            setFileIds(fileIds);
            setHash(hash);
          }}
        />
        <p>{hash}</p>
        {fileIds?.map((id) => {
          return <p id={id}>{id}</p>;
        })}
      </div>
    </>
  );
}
