import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#fff3db",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "#f79036",
            borderRadius: "50%",
            display: "flex",
            height: 132,
            justifyContent: "center",
            width: 132,
          }}
        >
          <svg height="88" viewBox="0 0 96 96" width="96">
            <path
              d="M14 50 L38 74 L83 22"
              fill="none"
              stroke="white"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="13"
            />
          </svg>
        </div>
      </div>
    ),
    size,
  );
}
