import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { TextPlugin } from "gsap/TextPlugin";
import "./SmartDomIntro.css";

gsap.registerPlugin(TextPlugin);

type Props = {
  onFinish: () => void;
};

export default function SmartDomIntro({ onFinish }: Props) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    
    // Set inicial
    gsap.set(root.querySelector("#text-smart"), { text: "" });
    gsap.set(root.querySelector("#text-dom"), { text: "" });
    gsap.set(root.querySelector(".sub-text"), { opacity: 0, y: 10 });
    gsap.set(root.querySelector(".cursor"), { opacity: 1 });
    gsap.set(root, { opacity: 1 });

    // Cursor blink (loop independiente)
    const cursorTween = gsap.to(root.querySelector(".cursor"), {
      opacity: 0,
      repeat: -1,
      yoyo: true,
      duration: 0.5,
      ease: "steps(1)",
    });

    const tl = gsap.timeline({
      repeat: 0, // ✅ una sola vez (intro antes del login)
      defaults: { ease: "none" },
      onComplete: () => {
        // terminar suave y avisar al login
        onFinish();
      },
    });

    tlRef.current = tl;

    tl.to(root.querySelector("#text-smart"), {
      duration: 1,
      text: {
        value: "SMART",
        delimiter: "",
        scrambleText: { text: "SMART", chars, speed: 0.3 },
        } as any,
      onComplete: () => {
        root.querySelector("#text-smart")?.classList.add("highlight-smart");
      },
    })
      .to(root.querySelector("#text-dom"), {
        duration: 0.8,
        text: {
        value: "DOM",
        delimiter: "",
        scrambleText: { text: "DOM", chars, speed: 0.3 },
        } as any,
        onComplete: () => {
          root.querySelector("#text-dom")?.classList.add("highlight-dom");
        },
      })
      .to(root.querySelector(".cursor"), {
        opacity: 0,
        duration: 0.1,
        onComplete: () => {
          cursorTween.kill();
          const c = root.querySelector(".cursor") as HTMLElement | null;
          if (c) c.style.display = "none";
        },
      })
      .to(root.querySelector(".sub-text"), {
        duration: 0.5,
        opacity: 1,
        y: 0,
        ease: "power2.out",
      })
      .to(
        root.querySelector(".container"),
        {
          duration: 2,
          scale: 1.1,
          ease: "power1.inOut",
        },
        "-=0.5"
      )
      .to(
        root.querySelectorAll(".container, .bg-grid, .code-snippet"),
        {
          duration: 1.2,
          opacity: 0,
          ease: "power2.inOut",
        },
        "+=0.4"
      )
      .to(root, {
        duration: 0.3,
        opacity: 0,
        ease: "power2.out",
      });

    return () => {
      cursorTween.kill();
      tl.kill();
    };
  }, [onFinish]);

  return (
    <div className="sd-intro" ref={rootRef} aria-hidden="true">
      <div className="bg-grid" />
      <div className="code-snippet s1">const init = () =&gt; &#123; ... &#125;</div>
      <div className="code-snippet s2">await scale(automation);</div>
      <div className="code-snippet s3">if (smart) return true;</div>

      <div className="container">
        <div className="main-text">
          <span id="text-smart" />
          <span id="text-dom" />
          <div className="cursor" />
        </div>
        <div className="sub-text">Dev &amp; Automation</div>
      </div>
    </div>
  );
}
