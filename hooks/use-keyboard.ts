"use client";

import { useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

/**
 * Custom hook to handle Escape key press.
 * @param callback The function to call when Escape is pressed.
 * @param enabled Whether the listener is active.
 */
export function useEscapeKey(callback: () => void, enabled: boolean = true) {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                callback();
            }
        },
        [callback]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener("keydown", handleKeyDown, true); // Use capture to handle first
        return () => {
            window.removeEventListener("keydown", handleKeyDown, true);
        };
    }, [enabled, handleKeyDown]);
}

/**
 * Hook to navigate back when Escape is pressed, but ONLY if no modal is open.
 */
export function useBackNavigation(enabled: boolean = true) {
    const router = useRouter();

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                // Check if any element with data-modal="true" OR common dialog roles/classes is present
                const modalSelectors = [
                    '[data-modal="true"]',
                    '[role="dialog"]',
                    '[aria-modal="true"]',
                    '.rainbowkit-modal',
                    '[id^="w3m-"]', // Web3Modal handles
                ];

                const openModal = document.querySelector(modalSelectors.join(','));

                if (openModal) {
                    // If it's your custom modal, it's already handled by useEscapeKey in the component.
                    // For external modals that might not handle Escape (rare but possible),
                    // we can try to find and click their close button as a fallback.
                    console.log("Modal detected, preventing back navigation");

                    // Optional: Try to find a close button within the open modal and click it 
                    // if it's an external library that isn't responding to Escape.
                    const closeButton = openModal.querySelector('button[aria-label*="Close"], button[class*="close"]');
                    if (closeButton instanceof HTMLElement) {
                        // closeButton.click(); // Uncomment if libraries genuinely fail to handle Esc
                    }
                } else {
                    router.back();
                }
            }
        },
        [router]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [enabled, handleKeyDown]);
}

/**
 * Hook to enable ArrowUp/ArrowDown navigation between focusable elements.
 * If containerRef is provided, it scopes navigation within that container.
 * Otherwise, it attempts to find an active modal and scope within it.
 * @param containerRef Optional React ref of the container element.
 * @param enabled Whether the listener is active.
 */
export function useArrowNavigation(containerRef?: React.RefObject<HTMLElement | null>, enabled: boolean = true) {
    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (!enabled) return;

            // Determine the container: use provided ref or find the active modal
            let container: HTMLElement | null = containerRef?.current || null;

            if (!container) {
                const modalSelectors = [
                    '[data-modal="true"]',
                    '[role="dialog"]',
                    '[aria-modal="true"]',
                    '.rainbowkit-modal',
                    '[id^="w3m-"]'
                ];
                container = document.querySelector(modalSelectors.join(',')) as HTMLElement;
            }

            if (!container) return;

            // Define focusable selectors
            const focusableSelectors = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"]';
            const focusableElements = Array.from(container.querySelectorAll(focusableSelectors)) as HTMLElement[];

            if (focusableElements.length === 0) return;

            const currentIndex = focusableElements.indexOf(document.activeElement as HTMLElement);

            if (event.key === "ArrowDown") {
                event.preventDefault();
                const nextIndex = (currentIndex + 1) % focusableElements.length;
                focusableElements[nextIndex].focus();
            } else if (event.key === "ArrowUp") {
                event.preventDefault();
                const nextIndex = (currentIndex - 1 + focusableElements.length) % focusableElements.length;
                focusableElements[nextIndex].focus();
            } else if (event.key === " " || event.key === "Spacebar") {
                // If focus is on something that doesn't handle space natively (like a custom div/span but with role button)
                const active = document.activeElement;
                if (active instanceof HTMLElement && container.contains(active)) {
                    // Check if it's a type that normally handles space
                    const isInput = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
                    const isNativeButton = active instanceof HTMLButtonElement;

                    if (!isInput && !isNativeButton) {
                        event.preventDefault();
                        active.click();
                    }
                }
            }
        },
        [enabled, containerRef]
    );

    useEffect(() => {
        if (!enabled) return;

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [enabled, handleKeyDown]);
}
