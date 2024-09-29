import { html } from "hono/html";

export const renderHTML = (
    title: string,
    inner: any,
    user_logged_in: boolean = false,
    active: string = "all",
    searchQuery: string = "",
    canonicalUrl: string = "",
    prefix_root_url: boolean = false,
) => {
    const root_url = prefix_root_url ? "https://minifeed.net" : "";

    const canonicalUrlBlock = canonicalUrl ? html`<link rel="canonical" href="${canonicalUrl}" />` : "";

    let userBlock = html``;
    if (user_logged_in) {
        userBlock = html`
      <a href="/my/account">account</a>
    `;
    } else {
        userBlock = html`<a href="/login" class="bold">Log in</a> or <a class="bold" href="/signup">sign up</a>`;
    }

    return html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="utf-8">
        <title>${title}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        ${canonicalUrlBlock}
        <link rel="shortcut icon" href="data:image/x-icon;base64,iVBORw0KGgoAAAANSUhEUgAAALQAAAC0CAYAAAA9zQYyAAAAAXNSR0IArs4c6QAAIABJREFUeF7tfQl4VNXZ/+89d7ZMVpJAQjITwiogrrgWEqLYulSrVaHivrRYaxECFmu/2ub7qv/aqoDiUrFutatYrQt1qdWwqKWtrVZF3IGEfck2mfXe8/45N4QGCMncO0sCzHmePCw5y3ve85sz73lXQqZlOHAQcYAOor1ktpLhADKAtg8CmjDXP1jT6SYCT2LmHWDcm214lry48NOI/WkzIxPhQAbQNrl36gz/cN2J34FxHGjXxcAIMGFh6UkNtyyeCsPm1JlhCXAgA+gemFdXB/Fyi+9wh4ZJYNI1I/ZS/YJNa9SQSXN8P5JMPyZAdJ2CgSYQTVx+17pVCZxLZqhNDmQAvR/GjZ9e5s3OEXPB+A6IBgJgMLaR4J9EJX7pJPo9gK91M1wS84VL5zc+Y/NMMsMS4EAG0N0zjybOKr9UCPEQAPdeXTYDxvmAuAagq7sZHhGCz6i/s7E+gXPJDLXJgT4FdN3rNY4tWwd6gPYcB4QLkvMkGeXEWraU7HBq0KBpkFGjSYPWYDi4jQNGqI1CbZVr66N1dZA2993jsLF1Y10DW9seZODKbjoyEc9kpi0MPEKAt0sfCfDfDEf4jDd+vq0tFbRl5uyZA2kH9JWP1njczqxhDo3Ge1yucSTEGGauFELkEsgLcA5ADgYLgIignlwcJog2yUZopwiwxZDGaj1m1IdbAs8vurZ+uykOJLH1Ami12icgNAE4EoDHXJoRJMIyQ3DdijsbVyaRnMxUFjiQFkBPeRLagOCplW5X1jkuj2uqIDFeaMLVSSczII0OTGqaCeFemxpj6PrnofbQ9wb5w8/VnVKv9zrIQoeaWf4rpcCjcQ5hZrxpRPVL3rxv49o4x2S6pYADcUDH3qoz7jnTHSswRmZ5PZMFibOFJsaTEAUEdel2ND0isWl1EBtXtSOwLQYF0txBTgwe7UXp2Gw4XHsoELolREpu16W+JBaJ3rFZy/734qmLk6IumzC3OFfTs+YDPBWg3F65oD6PxG9KA7NX3J25oXvlV4o6JB3QU56cog2INo31urNvcjodkwVRIYh238Zdb+VVr2zHmr+3wojuKTFoTsKQ4/MwZnIhNFfvJDKY2ZCfh4LB6++95KWXk8UrBWoRyzqVgDNA+AaAAT3OrfQghNWQ4oJlC9Z+mCw6MvPEz4He0RLfXHTdb75a4HLgBE04LtOc2oVCaHtrB/aYaeMH7Xh78ZbdosbeyzjcAkefV4yycTnxUQAlthibw9HotyLNG19adO3bsbgHdtPx5FpfoVPwOWCqApEDjLMAKPVdr42Bdx2G8Y3X797wUa+dMx2SyoGEAc0MmvG7M09xZ7nnCqGdKEjkqy/fnqg0dMaKRevRsjHa42ZKx3hxwsWlljYsJW8yorFZ86Y++wdLA7t0rppROpCczoUgnAve9eizMJl6Egjmp6nJcVn9Y2vCFoZmuibIAduAVla0rSPP8jsc4n9cbs+VQpAzXlqCO2JY/tAGRAI9i7tZBQ6cVlsB6l2U3mNpachmXQ9/rZG9b9qRqatq/RcBeJhoD5VcvNvr7GcQ6JZT8tb9LFXqRasEHQr9bQH6+scnFzmysq92Oh3f1DRtlFVGBZt0LF+0vldAewc4MHmWdUAreqSUzdFYbPoGdj9tFdSTZpffzCxu2+2jYXWDu/tTm2Scv2L+uldtT5EZaIkDlgH9nV+fcbzH43nY6XIejr38GOJdWanolt6/Hm1behE5RntxwiXWRI6uNEhDbm0Ph8+7f9qSN+OlTfWrnlMxE8x3KS3i3uMIvJZBZQDi+kZi5heiuueSlQs/bbVCQ6avPQ7EDeiZv51cQs7sK5wOx1yhaUX2lvvvqPXvBfDOM1thxLq3iTg9AkedOxBl47ITWsrQ5aZoLHLNRsp6Od6bunpW+akQ2u8AHrTX4k0MmkLMJ4Pwo/hATW2AvGjZvMY/J7SRzOC4OBAXoKc/eFpFdnHu/U6HdhoR9ai9iGtVUyRgfFzfjE+XN0Pqe4KaBGH4hHyMqimISxfd25rSMNaEwtGr7p32Qlz+FWfOGOEOuMKXEdPPABSq+YmxhomvX5bX+NJ4lHm8bdrDxKYqLx4eLjs1r+GUjCzd20kl/vseD6PuySmuHRw6zeVwPKA5nRWJL7fnDOp23vB+AOv+FUC4TTcN2FkFGiqOyUXZETkQymqYpGYYxmfhcPii4o9O+FddXV3vPiAMqrqxYgwYE9SnjySWLrun8dNOM3tVre8EIloCoLg3Ek2tB9EZS+9a95fe+mZ+nxgH9ouYKU+OdZVh2EyXyzVLCE3JjClpyjqoRyVi7YbpkOHyanC6lRtH8pdjyZ+GQqFZC6ctUV//Cfl/1MyqLJBCfwqgyfFRyn9sDzROe3sREtKPx7fWodurW9hMf/Acr7eA57qzPP+jHIUOJvYY0tgWCgSnb3GtW7J46qqeX6U9bHyXA9MCBq6Lkz+f6uQ47c27vsj4esTJMDvd9gF07ZNTsoTTqHMIoRzb4zfT2Vm9j8awlMFYTF/YFone+8tLX2y0SQZVz6m4Ccz/L045egdBXrh03vrXba6XGRYHB/YAdN3rV3ram9seIEGXkjL3HtSNdV03Poy0h35ITfTywhtetBzYWj27/FpAPBAXoJkNJv7m8nnrHzuo2drHm9sNaOWnXJRXeKvDKWYebGJGTzxm5rBh6K9LKZ+LGXgvEta3erK4CVFEDFdI6k250h3RjU3Lc/TFi/f05Kuu9V0M0K/jNsAwblk2v+HWPj7zg3r5TkDTDb//6g88Xu/NBCSm+D1A2cUM5b/aBOIAmNqZZURKGZaSAwRqIk3bJNnYEQ6Gt5BDvp/j9az518oPLoiFY3czOK4nLAPzls9rmHOAsuiAINs8iOt+deak3DzvSyRER/RFpvXKASmloUdjsVAo7AkGgggE2hEJR6DHdOi6DkM3IFlFZP13KiLMX3pXw+xeJ890sM0BuuxXX8ke6PU+7HA6lJFgj2YGQGVa3BwwDMMEdCwaM8EdDIYQDLSjPRA0/09KeduyeQ0/jHvCTEfLHKDzbxszOKrTC0TiWGWhE0J0/GgqtkTA4XDA4XTA6ez40+F0mn/XHFpHxJ9y6CABNbazZT4I+55DqD2EUCjyF4egm0u80Y+wCuG6unrlbpiQPtzyiR/kA+iE68uL3B7xFDFqrOxVgVYBXwHbBL1Dg6aAv+sDoIDf8Tv10/Eh6PhAOKBp+/j8WFn6gO6romsMXa6VUv6LmN+SuvHP1mDT249c80YmSjwJJ0sqgHXTW/57ifDtJMy3j8iigL/7R3T8XYHbneVBVpbH/NPj8SDL64HLvU+kVrJJ6lfzMUMS0KYbxsZYLLq4aWPTL5+Y9ca6fkXkAUaMKSdMmuM7k0HPgdEnuudOEUXd3B4T5G4T5G6PC26327z5zW8ATTNv/YP1hpdSRoyYsYyl/E0kYvx9q8f72eKpi21bMw8wLCaFXBPQHWmvtL8COCkpsyZpkt1A7wJmp9Np3uTZOV5kZXs7bnlPUhwAk0R14tMoFSJLuc7Q9b9Fo/oTmzfvWLZ49luhxGc++GfY/ZKrnuOvBvMS4MAyd6vb2ulyIjs3Gzm5OfBmZ5m3vLrJhVA/HWLOgdqYpbJo/iscjtzjNYy/rPXkb4/Xr/tA3XMidO8+aeUD3O6MPA7G1LgtX4msnKKxHRoaAbfbtUtOz0JWtpLRvaYI43Q4U+LJl6Lt7J6WJccMlu8buv5CLBz5Uyy47b1EI9tTTXNfzL/H1VVV65tERH8CUNAXxKRyTfMx6nLCm+NFYeEA5OTnmg9R9QE4oBqBpSEDsUj06fCOtrpfXFdvpvfNtA4O7AFo85Z2RH8G4u92F093MDFNiSoOlwNer9cUV7xKHvdmweV2mmrI/t4YYJZysx7Tn9Qj0d+1xULvPHZV/SGfMmEf4fL0Wl9hmGgJ97MHYioBZqoVBZlA9rjdyMnPQUFhgQlydav358YMg1luj8WMF6KhwJ33X/7qIZ2xqdvX0qRa39ch6CFmJBwM25/B0BNtCuTqts7OyUH+gHzzsam0KQrg/VFMUTe2NIxNejS6MKLzH0o+WbLmQI5hVHlf6tdUulC5Rq+vQ9yJOLsF9ISri3NFQdbPwPi2urwOVFAmjW4CHJrDVBdmZWchryAP+QV5JsD7G7iVyk+y8X40HH1chAKPL7iqvjlpfEjTRCfOHFTi0jxXE3g0iDewoS1evmDtv+JZfr9gPXHm0BK3pqvYu2PicmCPZ7WDqI8Cck5eNgoHFqGgIB8uj8sEdz9SEXI0Gn0zFDFmb3dmvXOgGGgm1FYcrhGrch/jusBlAwlx4dI71/6tN9+XHm/fCXMqJmqSnwCh8iDCYtK3oow96ubOzctBTl6uCXT1f/0B3NKQOwzd+E0oHL7vgcte6tfJI6dMgbbZ578XhOl7JzFi4AOXW07660/XqwT3+209AtpcwO//NhgqcWFG9Ijjo6BArB6XRYOKMLi81DTj9wNgS0M3tgQC7XO3e/L+0F9v65NrfVlOwhsAKalg76ZSFdcsu6thmZIYauoq3a7PQtorwzeH0KU0Sa8gNc3i2dodIHwrvkxBcZz6IdJFaU7y8vIwoKgAOXk5pg68L/1QmDmq6/pT0dbA7cVrJ34QV36SNJ5VzZWVHlloKMAe382yEjCqJGibgFCR9qczyEvMK0ngzqV3NfxjHz30/mhXib8dRtYiVlZEm/ns9pi70wO4149TGrmZyqUIpoVSiSVFAwvN21uJJH3RzOTwzA2hYPj/ikvbH092KY9E9qQ0G39trVhAMO0ge6OjnRgzmHAVAxO61IdUCp4GCf7ainnr340bUtXfHTIULuO3ANlyYGJJiO1wItjghd7ScZjOghg8vhBchVGQOHT83JWv+MBBRSawlTFH+YinuynPvlg08otwCHc8cPkLG4iSE2hQUwdHpMXnzNViIroty6ipXBN/tTIGTaotP4mFeBpAd1k6zcIf3fGKGfNVvGbcgFaTTJxdPoogHiZgoqUDYKD98xyEGrPA+p5LksbwlIeQPbTdrH11KDXlQJWdnY38wnwUFReaN3haG0PqeuwfkXD4xwmW8qAJN5T5HZp2tiQ+mkAFYLggECFQq2TsAMttDNpGAk2CZYthUJBcwiEMwyVJ5AvGMCYMB2PELpGj5/If+0rYT4om7QpLgFZzTJg59DBNUymw9lCr9HgO4Y0etK3K2//LVDByRrfBM/jQtdwqh6oBRQNQ5htsytrp1G+z5Pb29uAPxAB+cOFZlvOT0MTaismakL9kpiFxfSA7atHoYLN0n0iKwoFw37LchhssA1pd+RNn+k4Qgh4C4YjeNqBu5Jb/5CPW1HM0intQBHlHtPQ23UH/e6UhUYYbJWsrC2W6TO8qbUMsZvw+Egrdev9lL6uklL02JfO+1uo7gyHuJ3B8YO51Vusd2PwGoK8tX7DuDTuAVitS9awhoyGkuqnH9kSCEdLQ8u8CqD97ao5sHQUnNB1SsnRP/FA3tPLrLi0vQfGgYtO/O+WNVZ5Vuba9PXzN/Zcs6S1lGVXfWH4KS7GYdqUcTjl9HQsoufTfIIwlNpPO/wNSzl5asH6lUt/ZBbQJ6olzKo4VzPcDOBboPnzLBPQ7BTCCGUDbPfCc3GyUlJWYN7Yyv6dary2l/CIa1W/eANcz+9NZT5xdfpRG2mPMfLTdfdkc97HhNL7s1OFlaLlOh/PjV3/2+e6v9kQAbYJ6wlz/YBHj24loWneg7hA5ChBr6llNlVqRg7cC9C8GvwuQQUA5A8Oo4yVdxEB+FzWQTT6ndpjSaStX1+KSIgwsGZhyUUQyN8fC0YXBZr590bXPB7vubuJ1FQNEFv+egdPSyjclewMvEfFLLPn99jGly9/eq3xfooA291kzp6xYSsdtTLiIwPu8/tSjMLA6F0p1111Tmg7zUViatEehSmge2FkFdhWAPwnGHwc2Nn6xeDH+W3arDuK00IDcMOUWCd2oBItjwGbt7qFg+EFmkEOW+VrvZ1ZS5flX5i/DgOIBptNUqmy4yhAjdfnTnMK82+tOecw8HJVGuKi17aadf69LK5j3Ag4DUUF4WpN842vzG9d3/jopgFaTnVNX5m1u1aYS8w9ANLLr+mwQgmu9CK3zQv29a1NgzvKF4K1MltqOtxKUP7dYzLHIP5bfs2kb4tSxKlN/07BhOeGoXiSYKgk8ggUfyYyrEizxlvTrW2lFlO/IwNKBKCwuTKUFUuX3e7ylre1/F1328sZdUU2/ApD0ig42mKQuqPklDQ3f77yskgboTmJOrvUd4SQ8zqCj9vgEMxDZ5kbw82wYEQGV31Dz6qb+2VUUTcYt007MT+tOedsb3g2fdLXv22DU7iETZ/lqBNFr/e2W7rqn3LxcDBleYZrXUyFfm77WMePp1i/WfvvDDVueIOD0dHpgqpIe+/s2YMZKLV+rqa/rKHCadEB3iiCGFN8hImVzL+m6jhI7ZFQBGhAuCXVDJ9DU4E1MeEmwfMIby3rzxYWfWs7zvL/1q2YNGUwkHwPhKwnQmJahytqotCHqxlYpHpINbBUZ0x4IvvvJBx+PC4fDacsIRMBnEniWwDd0l+aZgHejzCe/Nb/RTPOQEkDvlrWa28eR4J8wWD0ekssERgCEpyXp9xhSW9W5ob3Ro4IVnHnu4boAO8LRz+rv3xqIB2EdOtby/wPoJmv5slkHSKl0Usbb/dHfGQisvPxKy0vN6PekNgaam1rw2UefIRpJcf4b9QAU+FBIXGFwaD2E5y3CPoYbJtBvAoGBV7+9qKO2e8qZ3uESSF8D+FqAlHpPPRrtrquIXs+E1yH5F8vnNyoPq/1d8TRpZsVprPFdYIzbteIHGuSs1+etf60nR/EpdWNdW1tbLpYQSiVpxR4dIuI6ACFpFrunI4lRAtq3gGdSgdbNZCousqLSj7z8vD0SaSZj3e1bd2DNp2tSCeogQM9A0C3L7lz7haK5qtZ/LhEvZFD5LvFDyc+rSMhrl965/q2kPwp7Y9Tk68uLDBcdL5V6j3AOGPHb6pliRPJtBv1aCCzdkpP78aq6ngv+nFzrG+EkehEwfQO6tk8jhmPiyru/2Lw/mqtn+78GxiKQKS5ZaWsMprPfmL/ugxNnFOZlefKGSUMqefNKBo9Kt1ZAWRkHlhSjvKI8uQ5QDDTtaMYXH3+OSHJvanU5/RNMd0b0wEsrF+74b/XdnZ54Vc1lJxOJswGqAGEVNH7y1OzGz7rGTtq9Ka0c8j59a2aVVkrhvB5Ek8EoB1hVDVAiiXJPUunw1U0cInALQ6wA8aJldzYsj1dbYX6i5/jm7iqcuc/6zJi2fH6DCvPZo6mbeUtb62TJ9Gs71i9ifsqtxa585c7N7V0nVqqu4ta2rwOYDfCYXdmp0sZ7laZh2KihyM7JTqpsvW3LdlP8kEbvZR97AoxSwRHQCIhHRDh4d7xiYXdzpo2p3S0+dspYV6G/pZKEY6SQRplkFDAh4gB2GFJ8oWn6R/V3bdhm59NTNdt/P+2v5BrTzcvmr7u9c17l8mi0+I4lossAugLgXKtrMrCDYJyzbN6G/dYVr/nOwBwjyzNBMF/AIAXwXot2WqVjf/1dLhdKygehtKw0abc1KyeKrTvw+SdfmIneLTeG+pZcCsLLwiFfqf/5ersVyXYv3aeAtswACwNqZvuvlMCj3Q5h/huDPgThCwIVg2Q1mA4DoEpy2OGJZOJbl9/VqOTnXtU2KoXx5vqyMnaLW4joUotyugUu7NlVPRqVR9/IMSOS+mDc2LgJaz9fC5a9bl252bUS81KG8VtN4FXkbmi2kqagt83bObze5uwXv1cyrMeV/WuWOCsNj7J/OMgx5TWLRTXHT4czN9t/lCR8c6fseDagxK/UN5VAxz/UjwGFBUl5MKpSHOs+b8DmDZtVPMy+GyBsAPM9LMUKDeKDgV9a07Z4aherbRK3fNACWvHo5FpfuYPoagF8RRl67IgScfA6QszTTslvfNZuYpeaukoPWmNHSxY/gKDTdxbzTK6Ks5tNqAejb4gPJWWDkiJXKzl67efr9gfqH5Y0NNy+h+tBHIy10+VgBjRNmFuc44nkesNAgabpv93lFWiHT/sbs5lBNy7PW/fbZFgm1aN0c0vrhSCaxYCytKYU2EoEKasoM4MKkhEGFo1G8dnqz9G8o0tuG9OZn89eNq9R5XhJeTsoAa2+yrO9vnMg6HIQSsEUBFjpwPOTxVEGNhDz95blN/4+GWDeTdfOFFg128vL2CEuZ8KM/cTWJWsbZmSMim1UpvNkBO6qEncfr/oEoWBHfnbTiQjijKXz1vbmX52UPR10gFYWvtdb/Fcw8SJrFr64+akU+u+qmjRL72r4ZzyPwLhn7tLRjIBu8R1HRPcByuc4taWqlaPTiLEjzFIgiba2lgBWv7+6Q/NBCGuSz3h9fuPSROeNZ/xBB+iJ368YIKJyMUCT42GAhT4SjHUs8FvNiD1Uv2BTWvIyV80oHQin9k2CuD7Vj0YVQDB0ZKUZiZ5IUw/DTes3Ye1n69QjURqSz35jQaMycqW8HXSAPvEG30i3ZnrH+ZLIvVYQPRomutubs7YhmWqmeGhUar6tK8tGSqk9oUripNLzT2V6Gj3uMDOVcCJNSolPPvzU1FND8qXLFjT+JpH54h170AG65nuVpWwYL6lHVTdMUJEXmwAM64FBykLQ2W81gOUGx14sa9y0Oh2v9J4ObmJtxTCN+BYGLgSQE+8hW+2nLIvDRw0zE8En0pTI8eF/VqOtNTh3+fy1dyQyV7xjDzpAqyoEbY7wzwTRzD2Y0BG+8wiIG3eGYd2ybzJAioLlc4KwHOD3DNbWxnTXtpVFnwaS+uiL92T20+/EGSPyPK7oRTu/1pURZ3CC0+13uLqhRx0+MmHxo2lbEz7/eM29r97+qXrgprwddIBWHKuZUe5jp5jHQNUuzUYLgZ4n0n8gWbsXwD51zdWtTJBnL523Pi2v8URO1nz4tvlOZ8Y8gEYlJT1bNwQp34+Rh49AVpZ9mVpZD7du2fKyk9vPSUeRo4MS0Ops1E0dcISPYkC5G67XgffckYjGbs+TTDizm/OLSOZpK+Y3PpMI2NI2lkE13/MfLiXdA+aalMjVBLM0x8jRIxLSU0vJ7aFg5NJ7pz3/rBUHMzu8PGgB3R0zxk8f78zJ2Xw/g5Spea9GrWTwaUvv7shieaC0CTeVVWi69hQkjksJqFVY/MAijBgzPKFsTrpuvBsNhs5eeOmLCTsg9XQ2hxSgFSMmzvSdKDR6cq8gTxW29YDI027ujE07UABtilh1lQWy1VDeg1fscrBKKvnKouiv9JlWRbuhXQyOxGLRW+df8NytSSVu72splZP3y7kZdNLNlUPcEf0OSXSqEkd21mVcEGP+3f7CuPrlPvYiqqZuYI5s9fx4Z/qGG1NBr0pRph6JSldttxmG3BFobTntF1e8+m+7c/Q27pC7oXczpA5i/ODxWu7GXK6vq1fWv959H3vjZh//vqPOZOQ2KD9wQmKK5G72onyqRx9xWELqvFg0trxFhs57eOrLO1LBrkMX0KngZj+Y01TrOSJ1TKhNBTnKn3rE6OGJPBLDkXB4+oIpz/86FQ/EDKBTcep9PKcKTHaA7iPCJbtC25JGkXJmqhwxxMy1Z7fFYvrrsVD4vIWXvvjfmEG7kx3yMnSSGNffp1FWRUGszM22Ki70tD9Vn1HJ0zm59oyVzBwKh8I33HPRC79MNh8zN3SyOdrH851cm1foRP53QLiOgdJURZqrwqOjDh9lW/QwdGP9ls3NJ/7qutd256VLBusygE4GF/vBHKfOGTwkJh3nE+FqAGOA1OYCUUlsho4cikGlA23tXhUvioQiP3z3w7af19fV24iw7X7ZDKBtHUf/GaSiXDYF2s4kxv/syp7qThd1SuQYe/QY24kipW78KxwMnZtMY0sG0Ok6/eSvYxbq0Rya0mZcm67I8b23UT6k3DS62DG4MBCOhEI33P2NFx5KFnsygE4WJ9M4j0r7u81fXmNA/L+d+a9VBv2Uxh72tDUVizj2yDG2ddNGzPhP++YtNQ98Z0VTMliYAXQyuJjGOZQ/Snbe5ikwxDwQ29edJZHmMv9gVAyrsHdLM3MwGPrWvdOWPJwMkjKATgYX0zTHCdeXF7ldYjaA7xKZSS/7RVPFjcYcOdoscmSnxWL60h2tTec9dlV9l3BxOzPZyxJkb6XMqEQ5QNW1vvkgUrGF6S892wP1Sn5WCSH9Q+1FvTHz9lAw9PWF05YsT5hJiU6QGZ96DnzlxpLskHTdRMAPUq2Os7sbp9uJI485Ai6PdXGeASMaify/BVOe+5Hd9TvHZUSORDmY4vEqkaRsqbiRif831YlnEt2KkqPLK8psTaPH9NV3XfCM0p8n1DKAToh9qR9cVes7gTryXBemfrXEVlA1XlTEuJ3qt8yINW/bcfqia/6aUAhcBtCJnWFKRyv13OaKilfAfGpKF0rS5Kra7WGHj7LtMx0Ohp+++6LnL0iEnAygE+Feisd+6caSQQ7DtSlVoVWpIH+wb7DpjWerSbRuWb953KPXL2uwNd5mLmS7a2XGWeTA5B8MLYmFdeW8k4ZC3xaJ2093Vbr5qOOOtOm0xHq4PXLF3dOeV4k1bbXMDW2LbekZ1PEg9K8EmbXUk9VaGSrRO9YwaAux3M4EQUTfslT3pgdqRhw2HAMH23Naiun6PQ26Y/biqYv/W/XXws4zgLbArL7oWj2nYiaYFyS0NuNzCCzf6bz0NGD8W4RjTfWDtga7JNChSbX+6yRhfjI0KXkFeRh71BhblkNd1+ujwbByWLLl/J8BdEJISf3gideXjyK3eMtOESNFHTOvZOJrDaaPewoC3iWvPwfCiYnuSvl3HH70WFv58QzD2GLEosfOn/qCLT/pDKATPb0Uj1dGlbDh/AOIvmpnKZLiS0sXrN1dx29/c+xK3zuHiH6aqMyuLIewsR5RAAAYY0lEQVRDRw1FyeBBlklWmUvb2wKn3XfpS3+1PDjzKLTDsjSPYVB1rX8OBH5mJ+WXZOPLK+ZveDUeqr/0Pf9wp0Q9c+KZW1XMoUrNa8etNBKKLlzwjWdviIfmvftkbmg7XEvzmJob/OMMDSvJRmoCyfLWFfPXq+SUvTcGVdVWfJ8EK7fUhJrKizfu2MNtZVuKRKIfvVPcMq7+FOuRLBlAJ3Rs6RlsGlh8fuVeqUpsWD2zZSUNDafGmwr49FpfYRB4k8gsc2e7qejwo44/0pYHnpSGHmiPDHrgkiWWfaStMsf2BjMDE+PAruq7KuNQgcWZQu0Bo/jtRRtUzuu4WtUs/y0QqEs0wHboiEqU+krjWnPvTk07mk9fdOVfXrE6OANoqxzrw/7VtX6VlkDVSrd0blGpj/3bgo0fxkt6zezKkySMP+3M95dQAIHKXKoyLdmSo2OxGxZc8CeV+thSRitLjImXIZl+qeHApNkVUxisquNaSq0vIc9ZMW/9C/FSpUo4c5b7eWaqiXdMd/00TeDYk4+FyotntUXC0cfWw/VNqwaWDKCtcroP+1ffOGQosfEid5RxttDkt5fNW/+ghQGorh1yDUgmnAhm3LHjoCpsWW2xmPHnwLa151lNkp4BtFVO92H/mroah2z59D4QTbdCxs6wvbnL5zfeaeXr++RaX6GTsBogezbsXQSqPHgDbeTukJKXhwPtKp+0JYthBtBWkNEP+u6Sb1+zlLaAcOuy3IYfW60VUz3H//DOUnYqcY3tpsKyVHiWVTnaMIz3W1tbv7roilfXWVk8A2gr3OoHfWuurPTIIvkWWBXjjLstODWvYY7VWuTVs31ngeiPYNiLfgUwaPAgDBs11DKgpZSfGWF51ryLnvk47l1mLIVWWNV/+lbP8t/KAjfHq1Zj4IHShoYZ8eqiO3eqLIcOA38BMNTu7lX63ZFjR1jOrsTgtVI3zr7z/Gfet7J25oa2wq1+0ndibcVpgviPQNypDB4paWiYbhXQNbMqCwwyFhPhNLtbz83LxWFHHAan05qmg5k3xWLRc+Zf+JwqPx13ywA6blb1n467UuWqOENV0q33xryopLHxO1YBrSyUm/wV8wlsu8agKrOscnaoFLxWGku5PRyNnHfP1BdWWBmXAbQVbvWTvqYGAlgMorhiDQn46Sl5DT+0KkOr7U6s9V8lCI/Y3boqYzHmqDHwZlurdSglt0ZC4fPvmfaCJa+7DKDtnlQfjlOGD+n2/AqEr8dDBgFzls5rmG9Fbdc5b9WsIcdC8FsEtp5wQ2XEcTjMG1pFhFtpUspgJBi64J6L//ySlXEZQFvhVj/pa/pIS5dyVuquIu6+VBJfsOyuxqftkK/KWzgFNYBRZGe8yiM95sgxyMvPtTScpQyEwpELFl70giV/jgygLbE5/Z1r5lSOZjYuZ/AJALWSwPOka6+z0Bcy6Ow4KIrEmIe/Nb/RVgSImr+q1l9PhElxrLVPF6V/VoDOH2AtFZ+UvCMcip23cNqzltKDZQBt55TSNKZqRsVYcuApEI/cnc+OEQRRPTGGM3EcJnD+W0lD40SrD8KuW6ye7b8jkfqHSuRQjkqWGvP6WIzPmXfhHy3VNMwA2hKX09d5/HQ4c7J9DzPRZfusquo5ELhXPTSDiXjW0nmN9yRC+cQ5FZcJlo8CZCudwpgjRqOgyBqgGfyFQXzWXef8cbUV2jOAtsKtNPY9cUZhntuZrTzkqhJY9gtDN2reuGeDJfPx3utVf8//FRh43m5idTuAVpbCYDh01n0X/TljKUwAAP1mqJnYPGfLH4D4NBndEM4ALxR5jXPq65BQUZ5T5lSMN5iVPtiWCdwmoD9oa9p+9i+uql9j5VAyN7QVbqW3L1XV+r9GhMUAnHsszeA4nPwlYN6qvxN52rP1dWvCdsmvqfWNMIjeJVgvt9zxKBxtOd+dZPlGYP3mc6yWqsgA2u4pp2HclCehbVxZcbFgVpEbppqAgb8ToDLdfzlOX5wQAw8GAw1z316EmB2yJ8wtLtN0z0cAWVMmq3wImmZqOXLzrQ01DPli65aicxddu8gSzRlA2znhdI5RaQxmDKmEh4+HNDxgcSEDZxDtdWv3QJNy9GHwuSvmrX/XDukTv18xQETlWoCsKZPVV4vTaQI6O9draelwKPL7DeS+NBOxYoltB1bnSXP8t+3Mw/K9vUUQNrUZeB6MY0Hd5tSISMgLrYRhdeXMCTeXF3mi9AXYOqCVD4eqkuXxWhO/Y9HobXnvP/sjq+b6zA19AGG6utb/t/2k6lJVHc4DtGsAfG3vLTEjyOALVsxvtGRG7pynZm65T+pCqc8sxTKq8d5srylDq6ykVlqoLTjtnkuW/N7KGNU3A2irHOvD/tWz/W8D+2YiZUAK4rMNSaWCsGjvokIMfpdZnL9i/rrP7ZBfNadiLDErN05rHkYAlPuoivxW+e7ibczMO7a0Dv/lt175It4xnf0ygLbKsT7sXz3b/wswpnej4djoYD5+xOiSLatXb/0/Jp69O4so8zaQdsWyeWuVu6mllACdW50ws+LLQuMX7GQmVRbCUYePtOTgH41EN7cPbfQvOu5tSw/CzA3dh+C0s3TVTN+R0OgeYkwEmUnQlcXwcwLPXXZX4zPq36YzEfPJEOJYydgO0FK7N3MnjdW1vmuYaFGvlsluNmUnBCsaif16/oV/UlmiLH8AMze0HWT11RgGnTrbVxYjUvrp40hik2T9j6XrN767j69Gh6baMiC621r1bL9SG6r6iJbbkOEVKPNbq4wVbAlcsfCyF39lebGMDG2HZYfYmDqI6hbfOzuDZY+ws/PRR4zGAAt+HIYhmyXpR84771lbdVYyN7SdUzqExlTPLvMDYpUdo4pK2HjMiUdb0nAYur60VW87d9HUV1vssDkDaDtcO4TGVM32XUBMi+Mwte/DFTu57XRdvyP3P89836r+OaPlOIRAaXerHUGy/p8TMNvOHCPGjMDAkmILQ1kPB0MX333REuW/YqtlbmhbbDs0Bpl1V6T7GYC/ZHXHKm3B0ScebSlRo5SyefPGpnG/uu4129E1GUBbPalDqP+kWn8VE5RPtrX4KQAqwYyqKksiTogxEAyGHlk47QVl7bTd4lzN9vyZgQcwBybN9j/KwJVWt6BcRiuG+S2p66TkUPOWpqMfmv5XSw79e9OWAbTV0zpE+isfaEn0HzvmbpW6QJm7cy1Eesd0fem8859JKB+1OpoMoA8RgFrZZk1dpUe2Giqf9OVWxnX2LRhQgMOOGBV3wSCWiEVj4TkLpjy/0M56XcdkAJ0oBw/C8VWzyycTxJMACq1uT4kbquimlduZpbEmEI6cdf9FS+Ium7E/ug46QJ85Y4Q7ZLQMENmebDZkTpRFnkNwjiRN7PFJ1hGSGrc4dS1gaJGgDDkCjg/XtdXXJxZ/ZxUA/a1/RxIb55MAnWnnG7ywuBCHjYsv5d6uvXM4FH0g1Nw4y2q2/u54d8ADesLc4lyX9IzVGUcIFicCPI6Ji8CkfHezAHIws0b77lTF3BkARQAOghAAYwcDn0PyhyRoNaT4JEbGmp5KCvc3QCZETx1EVWvFTQT+iZ1qsspFdNTho5BfEL9SREqjqXlL+KSHpluL7j44bmjF8O2lRex2DNN0PgqCqhg0AYCqHWbZV7fnw2cF9nYGNxHhM0hazcB7JLBKSmqM6YFtK4t2BKxmxU8IcCkcrIwoW33+KZKg6qpYduRXpBUPKsaww4bG7SrKzEYsGrlv/pTnZyZrawfKDU01c8vLjZiYQiqsn2gUgwfY8c9NkHHRnRmEAgC2AfgC4HeY6HUY4j/LC9ZuPpDBPWFOxUSN+QkAlXZ45HQ5zVArb078sYMs5afBQOj8ey/983t21jzgRA5THnZHRhpMlxHzJQDKk7XxpM2jUgoIrGeJtwXwiiD5RpipoSU/L7CqbpX6APTrZpq3KytOIoOf2vVNZ5le5YSkitUPslAcSCV/ioaitweb1/84GbJzJ9H984aug5jQUjHGQXw1My5kgq8n53KV4VLpPtUtocLmhSAIoZlWKpaKdR0/Upr6Iei6bv5dGtL8/yQ2ldBF3d6fAHibwSucZPyzpW3jBrspBJJI275TTYFW7fN9Y6f2tg4ElT/PViseVGQC2ko9wlhM/zgSbvnKfZe8ttbWovsZ1O8AfeaMwryAy/ttIWkuU/cpXJVqSIFXpWjNH5APVShdRRUrMMfTDN0wgR2NRtEeCKKtpQ3tgXboMR2GYSQb5DsIvJQlfi00uaz+zg3bk+V4H89e99dHPaa1aNYNEPih3YxIam4zqvuoMZZqeiurYDgcuHThRS/ZSvHb0777DaDr6iDqW/zHSuBHICiV0R5RlQqsqoBjbkGe+aeS1VTOh2Q1dVtHozFEwhGEgkGEgmGEQx0/0UjUvNETbAYA5bT+D2azitXfIzFa/fct65uxWGlb0tPGTy/zZnvpJAjx3Z20fNVuvjpFrSfLA+VRZ6mwJkPGYrFHd7Q1f/exq+ptZ3PaH7f6BaBr6uCQTRUXQ+PbwSjt6nurxIaCAflmrTsVEm/ewmmgulNEUTd2qD2ElqZWNG3fgXA4YooqCTYV/NnGYAXwl8H4Y7Bdvm+lwLzV9U1ZuaLiMGK+yUx1wMi34+Pcua7m0MxybUqzYaXput4QDYbPWHjpi6usjIu3bxqg0TMpJ1xfXpTlouuZaE5Xry710MgryMVgfxny8/Pi99qKd+c2+imQh4Id4G5pbkE42HF7K9An0hgUI+B9sHyFNV5ORB+L9sjGgVu3hhLI60xj68Y6B+xoLhWadgwRTwHTuSBYy8nVzcY0hwP+Sh9Ky0ss1R+UkltCweA19178Z1XBKyWtTwF94syhJW6HcReYp3bNBqTksvIh5VBWJ6vlwFLCpW4mVSKIArMSUVpb2tC8oxnBQDAZokn7zlQFG0C8jiFWEavHpfwwoOtfRIoKWwZhlRz4AXjx4WD8uCMItu5/QfWAaBs8nnI/3V6kx/TRgmg8E44nYCyAYXZ1y3tvXSWMqRhWAfUQtFIdlpkj0Wj0p+980HpbfV19QtlQezrjPgO0+SiJZT1mpotV8cm7WmHxAAwdOdRSHFrn2F0aC2UQiRIQZVPHAUMwYipBuOpHDGJiBzM0IiXQkANgFxOchG7siRY+IeFQBDu2bsf2bTtM2dt8YCoKktVUWgLCRu74swVgaSYBE8gG80CCGAzwoGQtt/c8Ho+SmYdb8tNQcygdk6EbzxgtfM2Cq/6kEk2mrPUJoM1ICMP1wK4qTiYNSsQYNHggfEN8pgYjnmboRgCCPpGG3Mws1wgh1uq6ERDMW+B2b9Tbw5FwrL1dbzdaSXbIBSw0jR0iO9vr9jrdTjc5nPlGNDbY5XIWS+bDNE0bxsxHCE0U2QV4p2jS3taOQGsAba1tCLaHkq09iYdFSemjbuLikmL4Ksot56hTBOi6vqSpKTD9kWv+siEpBPUwSfoBzaCqORXfJ/D/dWoyFMPKK8rgq/T1+jVm6EbM0I2/hGORx4DAqyVRRwiV0LG0RtbV1SX0Wpvy5BQNqz7Qyo8a5I00OY9y52Rd7HA4vq45tIF2D6JTB65u7K2btmLblu2mqHKgNOWfMXzUMDMCJe7oky6bY8n/1kOxc+dNs5eWwCqf0g7oiTN9JwqNVFhPx/OYgJLSQagYPgQOR/d6ZGZuN3Rjpa7HntX14LMffCLXp1IO283EOohLCk/MycnLOz4rO/tLmiaqNEHjQFRKVgTILqeiNCSBtoApd6sbPBQKIRpO/GFp9eB766/eMUr8KykrgaoGa6dJKVdHgpFv3TPthTfSpXtPK6DNgpEej6oMekIng1RBRlWyYH/J/PSY/nk0ov9QZ/lSySdLWuyGt9s5kK5j6urqxIaxK3Ld0lNJoLOdLsfFmtBGk6A93FLjXadDLcjQY0r3HUVrSyuatzejvb09GWrBeMnYp58S9waVDjJFjKwsj61bWU0qpfxnKBi97N5pz3+ULjDvuh9t793aQAZNrC2/VAixO8WTMpWqR4b6Otu7qVtZj8UWh1tDP7r/6ldsZdGxRqC13tMfPC3fne35ssPjuNrp0I4GiUHUkW/OdlOak0gkitamVrQ2t5hyd6f1MlHV4P6IUm8XdZkoI4nSKinthfq3zS8g9UrRY7r+ViQa/abVgj+2GddlYNpuaDMLfIR/s8sKaJKgUkSNHDMSSknftbHkgB7Tb5GB5scWXFWf0ldxgkyk6Q+ek+XN5aPgdJyuCbpQc2ijieyVP+tKiwK38jmJRXZZL0NhBANKRAkjFotBj3b4o1htCsDqFvZ43MjKzkJObo5psFKAVj4x9oGsdC4c0nX9MRkK/WTBZS9vtEpbMvqnDdBVtb4TiEildN0d1jN63GEYULzn7cxAOBqJzlgw5Vnll3tAtSsfrSnI8Xgvcrvd12qadhgIHruakv1tXIkqpi/KLlElHAyZPimxmL77Nu+aNVcB1OV2I8vrgcebhSyPp8OJy6ElBN49LiCVBVVyWzQS+ZncrN+18IYXI311cGkDdPVs//+A8ZNOnbO6EY4cf8Q+t7MejT2+va151mP9+2bu8byu+eXphd5c5wSnpp0mNK2KiEYLIey9rCwgo1OjsvcQdSunqjGzbujyr+FQ8I5Y+9ZlyXQFtUNzWgA9tm6sq7i17dWuRST9Q/3wDdnTvVmPGesDrW2nPHjVX5T75QHf6l6vcWzekJ2rGfIYh9txrcPpnKw5NFtF4PsjMwxD3xANxX7cGgk89dhV9Sq5YhKtSPZ2nBZAV80oHUhO5wcATH2u0mceccw4ZOf+N9JHPQJD7e3TFl78oqqtd9A1pSXZNORvFU63ON3lcVcJEseRIB8I3mSLJallHuvS4HWGri8JhkKLfnH5K++ndj1rs6cH0DN9R5KgdzrFDaXXPPyYsXu4fxox489rDe3ri6cuPnCsDtZ4vbv39AfP8Wo5stTlEmOJtNME0ekOh6ggEvHHL9lc2/YwhjR0o1GX+uN6RF9MO/jjvpSV97ePtAC6epbvfAja7WFVUJhvRgd3OuQzczQSjd1w95RnVXKTQ65Nf3C805FdcLRDyzrL6XJMJE1Tuu5iUp5xBK2PbnBVu8dQQcLSkB9FI5HFelPrE1Yru6b7MNMC6KrZvm8RSFVnMpvy2Rg2atjuVzZL3twebJt838UvK7HkkG5XPlrjycl2DXZpnkoJMZIMOV5zaGNUBn0htGxSZZJTdGrKiYhAEV3X1zPLN5jFW0Ys+p9AsPm9R655o+1AOJgUsWbPrU+cVT5dCLH79h1cXoohI4bsBnQ0El25LRSa/MTlr7QfCEzrKxqv+eUpE3Lyco8B02SHU4x3OBz5YHYyw0GClD+hUGA363AqL7x9T1dFV5ruhiBIdQUDiElDtsZi0Xcl87NtTe0vPnadtYLxfcWP7tZNC6Brav0XScLvOglQRWRUMZnOFo1G7ph/wXM3pdNE2p8OwQ4tKmRt9cDq8hyXZ1B2nidbOLUBhq6XEMtcQMsSQriFIKE5NIVtYsNgqeu6BEJgNBNpG3TWm0Ph0JYWz4bPFk/t/xHq8fApLYCuqvVNIlI+6B1NedYpJ/HO1tzc9s0HL3/p4XgIzvTJcKAnDqQF0F/6nn+4Q4dyUjFt3Hvf0O2tTUfee+mrSUs2kjnyQ5cDaQH0ybW+Qoeg94hhFqwrLS9F5S4Z2jAMIxZqKb/74r9uPnSPIbPzZHEgLYAeP328Mztn84sATVaEDywdaDqNKwOLYUgVp1R25/nPbEnWpjLzHLocSAugFXurZvlvIQEVpWImh1EpV5UeWrLkaHts8N0XP5e5oQ9dHCZt52kDdPXssi8B2p8VnvewFLJSM2nlPz/39ymPN0sa1zIT9VsOpA3QNXPKiiVrKiHgJOX9dcT4caYfrmotLa0X/uKyl1OWq6Hfcj9DWNI5kDZAq8w9m/2+W3YmEvix2sWwkUNRUl5ibigSidQtmPLc/yZ9d5kJDzkOpA3QHXL0kGNJyBUqOXleQZ6Z5E85oOsx/al1xkeXHCzK/UMORf1ow2kFtKntyN6yAITvKLHjyOOOMCOKDd1Y3aq3nmS3YHk/4meGlD7mQFoBrfZqpv/SYn8HqKJMWQyH+pXLwcZtrW3VD1/28qd9zI/M8gc4B9IOaOUbUzXbdyMR3erN9rqU+s7tcW9qam6a9NAViVURPcDPIkN+EjiQfkADqJlVWSCF8TIRnaC87koGD1rbEowet+ji51X2+0zLcMA2B/oE0IramlmllQY5H3V7XMceNm7Ub8R21PbHCAjbnM0M7BMO9BmgTVDPKSs2dFFWMbx8zW9uWNnaJxzILHpQceD/AwB49yu8rjaUAAAAAElFTkSuQmCC" />

        <style>
        :root {
            --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
                sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
            --font-serif: "PT Serif", Georgia, serif;
            --font-monospace: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas,
                "Liberation Mono", monospace;

            --color-text: #000;
            --color-link: rgb(0, 0, 238);
            --color-green: #05620f;
            --color-red: #620529;

            --color-gray: #555;
            --color-bg: hsla(50, 25%, 96%);
            --color-highlight: #ebebeb;

            --padding: 1.25em;
        }

        html {
            box-sizing: border-box;
        }

        *,
        *:before,
        *:after {
            box-sizing: inherit;
        }

        body {
            color: var(--color-text);
            background: var(--color-bg);
            font-family: var(--font-sans);
            font-size: 16px;
            font-weight: normal;
            margin: auto;
            padding: 1em;
            max-width: 900px;
            line-height: 1.35;
            overflow-wrap: break-word;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
        }

        a,
        a:visited {
            color: var(--color-text);
        }

        article a {
            color: var(--color-link);
        }

        article a:visited {
            color: purple;
        }

        header {
            margin-bottom: 2em;
            display: flex;
            flex-direction: column;
        }



        header a {
            text-decoration: none;
            color: black;
            font-size: 1em;
        }

        header nav {
            display: flex;
            justify-content: space-between;
        }

        footer {
            border-top: 1px solid black;
            margin-top: 2em;
            text-align: center;
        }

        nav.subsections {
            margin-bottom: 2em;
            border: 1px solid black;
            padding: 0;
            display: flex;
            align-items: stretch;
        }

        nav.subsections a {
            padding: 0.25em 0.5em;
            display: flex;
            align-items: center;
            border-right: 1px solid black;
            transition: background-color 0.3s ease;
        }

        nav.subsections a:hover,
        nav.subsections a.active {
            background-color: var(--color-highlight);
        }

        nav.subsections a:first-child {
            border-left: none;
        }

        img,
        video,
        iframe {
            max-width: 100%;
            height: auto;
        }

        code,
        pre {
            overflow: auto;
            text-wrap: scroll;
            background-color: #f3f3f3;
        }

        iframe,
        embed {
            max-width: 100%;
            height: auto;
            max-height: 30em;
        }

        /* ITEMS */

        .item-short {
            margin-bottom: 2.5em;
        }


        .item-short p.item-summary {
            margin-top: 0.5em;
        }

        .item-actions {
            display: flex;
            flex-direction: row;
            justify-content: space-between;
        }

        /* BUTTONS */

        button,
        .button,
        a.button:visited {
            appearance: none;
            text-decoration: none;
            background-color: #FAFBFC;
            border: 1px solid black;
            box-shadow: rgba(27, 31, 35, 0.04) 0 1px 0, rgba(255, 255, 255, 0.25) 0 1px 0 inset;
            box-sizing: border-box;
            color: #24292E;
            box-sizing: border-box;
            color: #24292e;
            cursor: pointer;
            display: inline-block;
            font-family: var(--font-sans);
            font-size: 14px;
            font-weight: 500;
            line-height: 20px;
            list-style: none;
            padding: 6px 16px;
            position: relative;
            transition: background-color 0.15s cubic-bezier(0.3, 0, 0.5, 1);
            user-select: none;
            -webkit-user-select: none;
            touch-action: manipulation;
            vertical-align: middle;
            white-space: nowrap;
            word-wrap: break-word;
        }

        button:hover,
        a.button:hover {
            background-color: hsl(0, 0%, 86%);
            text-decoration: none;
            transition-duration: 0.1s;
        }

        button:disabled,
        a.button:disabled {
            color: #959da5;
            border-color: #959da5;
            pointer-events: none;
        }

        button:disabled:hover,
        a.button:disabled:hover {
            background-color: #FAFBFC;
        }

        button:enabled:active,
        a.button:active {
            background-color: #edeff2;
            box-shadow: rgba(225, 228, 232, 0.2) 0 1px 0 inset;
            transition: none 0s;
        }

        button:focus,
        a.button:focus {
            outline: 1px transparent;
        }

        button:before {
            display: none;
        }

        button:-webkit-details-marker {
            display: none;
        }

        button.subscribed {
            background-color: var(--color-green);
            color: white;
            box-shadow: none;
            min-width: 9em;
        }

        button.subscribe {
            min-width: 9em;
        }

        button.subscribe .unsubscribe-text,
        button.subscribed .unsubscribe-text {
            display: none;
        }

        button.subscribed:hover .subscribed-text {
            display: none;
        }

        button.subscribed:hover .unsubscribe-text {
            display: inline;
        }

        button.subscribed:hover {
            background-color: var(--color-red);
        }

        /* FORMS */

        input[type="text"],
        input[type="password"],
        input[type="email"],
        input[type="url"],
        textarea {
            font-size: 1.25em;
            line-height: 28px;
            padding: 8px 16px;
            font-family: var(--font-sans);
            width: 100%;
            min-height: 1em;
            border: unset;
            outline-color: rgb(84 105 212 / 0.5);
            background-color: --var(color-bg);
            box-shadow:
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(60, 66, 87, 0.16) 0px 0px 0px 1px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px,
                rgba(0, 0, 0, 0) 0px 0px 0px 0px;
        }

        .search-input {
            padding: 0.25em 0.5em !important;
            width: 100%;
            font-size: inherit !important;
            min-height: 0 !important;
            background-color: #ebebe8;
            transition: background-color 0.75s ease;
        }

        .search-input:focus {
            background-color: white;
            transition: background-color 0.4s ease;
            outline: none;
        }

        textarea::placeholder {
            font-family: var(--font-sans);

        }


        label,
        label {
            font-size: 14px;
            font-weight: 600;
            display: block;
            margin-bottom: 0.5em;
        }

        textarea.contentful {
            font-family: inherit;
            resize: vertical;
            line-height: inherit;
        }

        /* UTILS */

        .bold {
            font-weight: bold;
        }

        a.no-underline {
            border-bottom: none;
            text-decoration: none;
        }

        a.no-color {
            color: var(--color-text) !important;
        }

        .muted,
        .muted a {
            color: var(--color-gray) !important;
        }

        .blog-summary {
            border: 1px solid black;
            padding: 0 1.25em 1em;
            margin-bottom: 3em;
        }


        .related-items {
            border: 1px solid black;
            padding: 1.25em;
            margin: 2em 0;
        }

        .related-items h4 {
            margin-top: 0;
        }

        .related-items .item-short:last-child {
            margin-bottom: 0;
        }

        .flash {
            margin-bottom: 2em;
            border: 1px solid black;
            padding: 1.25em;
            background-color: antiquewhite;
            border-bottom: 2px solid black;
        }

        .flash-red {
            background-color: lightcoral;
        }

        .borderbox {
            border: 1px solid black;
            padding: 1.25em;
        }

        .search-result mark {
            background-color: inherit;
            font-weight: bold;
        }

        /* ADMIN CONTROLS */
        .admin-control#hidden {
            display: none;
        }

        .admin-control#hidden:target {
            display: block;
        }

        @media (max-width: 550px) {
            header .logo {
                display: block;
                margin-bottom: 0.65em;
            }
            nav.subsections {
                display: inline-flex;
            }
            nav.subsections a:last-child {
                border-right: none;
            }
        }

        </style>
        <script defer>
        (function(e,t){if(typeof define==="function"&&define.amd){define([],t)}else if(typeof module==="object"&&module.exports){module.exports=t()}else{e.htmx=e.htmx||t()}})(typeof self!=="undefined"?self:this,function(){return function(){"use strict";var Q={onLoad:t,process:Bt,on:Z,off:K,trigger:ce,ajax:Or,find:C,findAll:f,closest:v,values:function(e,t){var r=ur(e,t||"post");return r.values},remove:B,addClass:F,removeClass:n,toggleClass:V,takeClass:j,defineExtension:kr,removeExtension:Pr,logAll:X,logNone:U,logger:null,config:{historyEnabled:true,historyCacheSize:10,refreshOnHistoryMiss:false,defaultSwapStyle:"innerHTML",defaultSwapDelay:0,defaultSettleDelay:20,includeIndicatorStyles:true,indicatorClass:"htmx-indicator",requestClass:"htmx-request",addedClass:"htmx-added",settlingClass:"htmx-settling",swappingClass:"htmx-swapping",allowEval:true,allowScriptTags:true,inlineScriptNonce:"",attributesToSettle:["class","style","width","height"],withCredentials:false,timeout:0,wsReconnectDelay:"full-jitter",wsBinaryType:"blob",disableSelector:"[hx-disable], [data-hx-disable]",useTemplateFragments:false,scrollBehavior:"smooth",defaultFocusScroll:false,getCacheBusterParam:false,globalViewTransitions:false,methodsThatUseUrlParams:["get"],selfRequestsOnly:false,ignoreTitle:false,scrollIntoViewOnBoost:true},parseInterval:d,_:e,createEventSource:function(e){return new EventSource(e,{withCredentials:true})},createWebSocket:function(e){var t=new WebSocket(e,[]);t.binaryType=Q.config.wsBinaryType;return t},version:"1.9.9"};var r={addTriggerHandler:Tt,bodyContains:se,canAccessLocalStorage:M,findThisElement:de,filterValues:dr,hasAttribute:o,getAttributeValue:te,getClosestAttributeValue:ne,getClosestMatch:c,getExpressionVars:Cr,getHeaders:vr,getInputValues:ur,getInternalData:ae,getSwapSpecification:mr,getTriggerSpecs:Qe,getTarget:ge,makeFragment:l,mergeObjects:le,makeSettleInfo:R,oobSwap:xe,querySelectorExt:ue,selectAndSwap:Ue,settleImmediately:Yt,shouldCancel:it,triggerEvent:ce,triggerErrorEvent:fe,withExtensions:T};var b=["get","post","put","delete","patch"];var w=b.map(function(e){return"[hx-"+e+"], [data-hx-"+e+"]"}).join(", ");function d(e){if(e==undefined){return undefined}if(e.slice(-2)=="ms"){return parseFloat(e.slice(0,-2))||undefined}if(e.slice(-1)=="s"){return parseFloat(e.slice(0,-1))*1e3||undefined}if(e.slice(-1)=="m"){return parseFloat(e.slice(0,-1))*1e3*60||undefined}return parseFloat(e)||undefined}function ee(e,t){return e.getAttribute&&e.getAttribute(t)}function o(e,t){return e.hasAttribute&&(e.hasAttribute(t)||e.hasAttribute("data-"+t))}function te(e,t){return ee(e,t)||ee(e,"data-"+t)}function u(e){return e.parentElement}function re(){return document}function c(e,t){while(e&&!t(e)){e=u(e)}return e?e:null}function S(e,t,r){var n=te(t,r);var i=te(t,"hx-disinherit");if(e!==t&&i&&(i==="*"||i.split(" ").indexOf(r)>=0)){return"unset"}else{return n}}function ne(t,r){var n=null;c(t,function(e){return n=S(t,e,r)});if(n!=="unset"){return n}}function h(e,t){var r=e.matches||e.matchesSelector||e.msMatchesSelector||e.mozMatchesSelector||e.webkitMatchesSelector||e.oMatchesSelector;return r&&r.call(e,t)}function q(e){var t=/<([a-z][^\/\0>\x20\t\r\n\f]*)/i;var r=t.exec(e);if(r){return r[1].toLowerCase()}else{return""}}function i(e,t){var r=new DOMParser;var n=r.parseFromString(e,"text/html");var i=n.body;while(t>0){t--;i=i.firstChild}if(i==null){i=re().createDocumentFragment()}return i}function H(e){return e.match(/<body/)}function l(e){var t=!H(e);if(Q.config.useTemplateFragments&&t){var r=i("<body><template>"+e+"</template></body>",0);return r.querySelector("template").content}else{var n=q(e);switch(n){case"thead":case"tbody":case"tfoot":case"colgroup":case"caption":return i("<table>"+e+"</table>",1);case"col":return i("<table><colgroup>"+e+"</colgroup></table>",2);case"tr":return i("<table><tbody>"+e+"</tbody></table>",2);case"td":case"th":return i("<table><tbody><tr>"+e+"</tr></tbody></table>",3);case"script":case"style":return i("<div>"+e+"</div>",1);default:return i(e,0)}}}function ie(e){if(e){e()}}function L(e,t){return Object.prototype.toString.call(e)==="[object "+t+"]"}function A(e){return L(e,"Function")}function N(e){return L(e,"Object")}function ae(e){var t="htmx-internal-data";var r=e[t];if(!r){r=e[t]={}}return r}function I(e){var t=[];if(e){for(var r=0;r<e.length;r++){t.push(e[r])}}return t}function oe(e,t){if(e){for(var r=0;r<e.length;r++){t(e[r])}}}function k(e){var t=e.getBoundingClientRect();var r=t.top;var n=t.bottom;return r<window.innerHeight&&n>=0}function se(e){if(e.getRootNode&&e.getRootNode()instanceof window.ShadowRoot){return re().body.contains(e.getRootNode().host)}else{return re().body.contains(e)}}function P(e){return e.trim().split(/\s+/)}function le(e,t){for(var r in t){if(t.hasOwnProperty(r)){e[r]=t[r]}}return e}function E(e){try{return JSON.parse(e)}catch(e){x(e);return null}}function M(){var e="htmx:localStorageTest";try{localStorage.setItem(e,e);localStorage.removeItem(e);return true}catch(e){return false}}function D(t){try{var e=new URL(t);if(e){t=e.pathname+e.search}if(!t.match("^/$")){t=t.replace(/\/+$/,"")}return t}catch(e){return t}}function e(e){return wr(re().body,function(){return eval(e)})}function t(t){var e=Q.on("htmx:load",function(e){t(e.detail.elt)});return e}function X(){Q.logger=function(e,t,r){if(console){console.log(t,e,r)}}}function U(){Q.logger=null}function C(e,t){if(t){return e.querySelector(t)}else{return C(re(),e)}}function f(e,t){if(t){return e.querySelectorAll(t)}else{return f(re(),e)}}function B(e,t){e=s(e);if(t){setTimeout(function(){B(e);e=null},t)}else{e.parentElement.removeChild(e)}}function F(e,t,r){e=s(e);if(r){setTimeout(function(){F(e,t);e=null},r)}else{e.classList&&e.classList.add(t)}}function n(e,t,r){e=s(e);if(r){setTimeout(function(){n(e,t);e=null},r)}else{if(e.classList){e.classList.remove(t);if(e.classList.length===0){e.removeAttribute("class")}}}}function V(e,t){e=s(e);e.classList.toggle(t)}function j(e,t){e=s(e);oe(e.parentElement.children,function(e){n(e,t)});F(e,t)}function v(e,t){e=s(e);if(e.closest){return e.closest(t)}else{do{if(e==null||h(e,t)){return e}}while(e=e&&u(e));return null}}function g(e,t){return e.substring(0,t.length)===t}function _(e,t){return e.substring(e.length-t.length)===t}function z(e){var t=e.trim();if(g(t,"<")&&_(t,"/>")){return t.substring(1,t.length-2)}else{return t}}function W(e,t){if(t.indexOf("closest ")===0){return[v(e,z(t.substr(8)))]}else if(t.indexOf("find ")===0){return[C(e,z(t.substr(5)))]}else if(t==="next"){return[e.nextElementSibling]}else if(t.indexOf("next ")===0){return[$(e,z(t.substr(5)))]}else if(t==="previous"){return[e.previousElementSibling]}else if(t.indexOf("previous ")===0){return[G(e,z(t.substr(9)))]}else if(t==="document"){return[document]}else if(t==="window"){return[window]}else if(t==="body"){return[document.body]}else{return re().querySelectorAll(z(t))}}var $=function(e,t){var r=re().querySelectorAll(t);for(var n=0;n<r.length;n++){var i=r[n];if(i.compareDocumentPosition(e)===Node.DOCUMENT_POSITION_PRECEDING){return i}}};var G=function(e,t){var r=re().querySelectorAll(t);for(var n=r.length-1;n>=0;n--){var i=r[n];if(i.compareDocumentPosition(e)===Node.DOCUMENT_POSITION_FOLLOWING){return i}}};function ue(e,t){if(t){return W(e,t)[0]}else{return W(re().body,e)[0]}}function s(e){if(L(e,"String")){return C(e)}else{return e}}function J(e,t,r){if(A(t)){return{target:re().body,event:e,listener:t}}else{return{target:s(e),event:t,listener:r}}}function Z(t,r,n){Dr(function(){var e=J(t,r,n);e.target.addEventListener(e.event,e.listener)});var e=A(r);return e?r:n}function K(t,r,n){Dr(function(){var e=J(t,r,n);e.target.removeEventListener(e.event,e.listener)});return A(r)?r:n}var ve=re().createElement("output");function Y(e,t){var r=ne(e,t);if(r){if(r==="this"){return[de(e,t)]}else{var n=W(e,r);if(n.length===0){x('The selector "'+r+'" on '+t+" returned no matches!");return[ve]}else{return n}}}}function de(e,t){return c(e,function(e){return te(e,t)!=null})}function ge(e){var t=ne(e,"hx-target");if(t){if(t==="this"){return de(e,"hx-target")}else{return ue(e,t)}}else{var r=ae(e);if(r.boosted){return re().body}else{return e}}}function me(e){var t=Q.config.attributesToSettle;for(var r=0;r<t.length;r++){if(e===t[r]){return true}}return false}function pe(t,r){oe(t.attributes,function(e){if(!r.hasAttribute(e.name)&&me(e.name)){t.removeAttribute(e.name)}});oe(r.attributes,function(e){if(me(e.name)){t.setAttribute(e.name,e.value)}})}function ye(e,t){var r=Mr(t);for(var n=0;n<r.length;n++){var i=r[n];try{if(i.isInlineSwap(e)){return true}}catch(e){x(e)}}return e==="outerHTML"}function xe(e,i,a){var t="#"+ee(i,"id");var o="outerHTML";if(e==="true"){}else if(e.indexOf(":")>0){o=e.substr(0,e.indexOf(":"));t=e.substr(e.indexOf(":")+1,e.length)}else{o=e}var r=re().querySelectorAll(t);if(r){oe(r,function(e){var t;var r=i.cloneNode(true);t=re().createDocumentFragment();t.appendChild(r);if(!ye(o,e)){t=r}var n={shouldSwap:true,target:e,fragment:t};if(!ce(e,"htmx:oobBeforeSwap",n))return;e=n.target;if(n["shouldSwap"]){De(o,e,e,t,a)}oe(a.elts,function(e){ce(e,"htmx:oobAfterSwap",n)})});i.parentNode.removeChild(i)}else{i.parentNode.removeChild(i);fe(re().body,"htmx:oobErrorNoTarget",{content:i})}return e}function be(e,t,r){var n=ne(e,"hx-select-oob");if(n){var i=n.split(",");for(let e=0;e<i.length;e++){var a=i[e].split(":",2);var o=a[0].trim();if(o.indexOf("#")===0){o=o.substring(1)}var s=a[1]||"true";var l=t.querySelector("#"+o);if(l){xe(s,l,r)}}}oe(f(t,"[hx-swap-oob], [data-hx-swap-oob]"),function(e){var t=te(e,"hx-swap-oob");if(t!=null){xe(t,e,r)}})}function we(e){oe(f(e,"[hx-preserve], [data-hx-preserve]"),function(e){var t=te(e,"id");var r=re().getElementById(t);if(r!=null){e.parentNode.replaceChild(r,e)}})}function Se(o,e,s){oe(e.querySelectorAll("[id]"),function(e){var t=ee(e,"id");if(t&&t.length>0){var r=t.replace("'","\\'");var n=e.tagName.replace(":","\\:");var i=o.querySelector(n+"[id='"+r+"']");if(i&&i!==o){var a=e.cloneNode();pe(e,i);s.tasks.push(function(){pe(e,a)})}}})}function Ee(e){return function(){n(e,Q.config.addedClass);Bt(e);Ot(e);Ce(e);ce(e,"htmx:load")}}function Ce(e){var t="[autofocus]";var r=h(e,t)?e:e.querySelector(t);if(r!=null){r.focus()}}function a(e,t,r,n){Se(e,r,n);while(r.childNodes.length>0){var i=r.firstChild;F(i,Q.config.addedClass);e.insertBefore(i,t);if(i.nodeType!==Node.TEXT_NODE&&i.nodeType!==Node.COMMENT_NODE){n.tasks.push(Ee(i))}}}function Te(e,t){var r=0;while(r<e.length){t=(t<<5)-t+e.charCodeAt(r++)|0}return t}function Re(e){var t=0;if(e.attributes){for(var r=0;r<e.attributes.length;r++){var n=e.attributes[r];if(n.value){t=Te(n.name,t);t=Te(n.value,t)}}}return t}function Oe(t){var r=ae(t);if(r.onHandlers){for(let e=0;e<r.onHandlers.length;e++){const n=r.onHandlers[e];t.removeEventListener(n.event,n.listener)}delete r.onHandlers}}function qe(e){var t=ae(e);if(t.timeout){clearTimeout(t.timeout)}if(t.webSocket){t.webSocket.close()}if(t.sseEventSource){t.sseEventSource.close()}if(t.listenerInfos){oe(t.listenerInfos,function(e){if(e.on){e.on.removeEventListener(e.trigger,e.listener)}})}if(t.initHash){t.initHash=null}Oe(e)}function m(e){ce(e,"htmx:beforeCleanupElement");qe(e);if(e.children){oe(e.children,function(e){m(e)})}}function He(t,e,r){if(t.tagName==="BODY"){return Pe(t,e,r)}else{var n;var i=t.previousSibling;a(u(t),t,e,r);if(i==null){n=u(t).firstChild}else{n=i.nextSibling}ae(t).replacedWith=n;r.elts=r.elts.filter(function(e){return e!=t});while(n&&n!==t){if(n.nodeType===Node.ELEMENT_NODE){r.elts.push(n)}n=n.nextElementSibling}m(t);u(t).removeChild(t)}}function Le(e,t,r){return a(e,e.firstChild,t,r)}function Ae(e,t,r){return a(u(e),e,t,r)}function Ne(e,t,r){return a(e,null,t,r)}function Ie(e,t,r){return a(u(e),e.nextSibling,t,r)}function ke(e,t,r){m(e);return u(e).removeChild(e)}function Pe(e,t,r){var n=e.firstChild;a(e,n,t,r);if(n){while(n.nextSibling){m(n.nextSibling);e.removeChild(n.nextSibling)}m(n);e.removeChild(n)}}function Me(e,t,r){var n=r||ne(e,"hx-select");if(n){var i=re().createDocumentFragment();oe(t.querySelectorAll(n),function(e){i.appendChild(e)});t=i}return t}function De(e,t,r,n,i){switch(e){case"none":return;case"outerHTML":He(r,n,i);return;case"afterbegin":Le(r,n,i);return;case"beforebegin":Ae(r,n,i);return;case"beforeend":Ne(r,n,i);return;case"afterend":Ie(r,n,i);return;case"delete":ke(r,n,i);return;default:var a=Mr(t);for(var o=0;o<a.length;o++){var s=a[o];try{var l=s.handleSwap(e,r,n,i);if(l){if(typeof l.length!=="undefined"){for(var u=0;u<l.length;u++){var f=l[u];if(f.nodeType!==Node.TEXT_NODE&&f.nodeType!==Node.COMMENT_NODE){i.tasks.push(Ee(f))}}}return}}catch(e){x(e)}}if(e==="innerHTML"){Pe(r,n,i)}else{De(Q.config.defaultSwapStyle,t,r,n,i)}}}function Xe(e){if(e.indexOf("<title")>-1){var t=e.replace(/<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,"");var r=t.match(/<title(\s[^>]*>|>)([\s\S]*?)<\/title>/im);if(r){return r[2]}}}function Ue(e,t,r,n,i,a){i.title=Xe(n);var o=l(n);if(o){be(r,o,i);o=Me(r,o,a);we(o);return De(e,r,t,o,i)}}function Be(e,t,r){var n=e.getResponseHeader(t);if(n.indexOf("{")===0){var i=E(n);for(var a in i){if(i.hasOwnProperty(a)){var o=i[a];if(!N(o)){o={value:o}}ce(r,a,o)}}}else{var s=n.split(",");for(var l=0;l<s.length;l++){ce(r,s[l].trim(),[])}}}var Fe=/\s/;var p=/[\s,]/;var Ve=/[_$a-zA-Z]/;var je=/[_$a-zA-Z0-9]/;var _e=['"',"'","/"];var ze=/[^\s]/;var We=/[{(]/;var $e=/[})]/;function Ge(e){var t=[];var r=0;while(r<e.length){if(Ve.exec(e.charAt(r))){var n=r;while(je.exec(e.charAt(r+1))){r++}t.push(e.substr(n,r-n+1))}else if(_e.indexOf(e.charAt(r))!==-1){var i=e.charAt(r);var n=r;r++;while(r<e.length&&e.charAt(r)!==i){if(e.charAt(r)==="\\"){r++}r++}t.push(e.substr(n,r-n+1))}else{var a=e.charAt(r);t.push(a)}r++}return t}function Je(e,t,r){return Ve.exec(e.charAt(0))&&e!=="true"&&e!=="false"&&e!=="this"&&e!==r&&t!=="."}function Ze(e,t,r){if(t[0]==="["){t.shift();var n=1;var i=" return (function("+r+"){ return (";var a=null;while(t.length>0){var o=t[0];if(o==="]"){n--;if(n===0){if(a===null){i=i+"true"}t.shift();i+=")})";try{var s=wr(e,function(){return Function(i)()},function(){return true});s.source=i;return s}catch(e){fe(re().body,"htmx:syntax:error",{error:e,source:i});return null}}}else if(o==="["){n++}if(Je(o,a,r)){i+="(("+r+"."+o+") ? ("+r+"."+o+") : (window."+o+"))"}else{i=i+o}a=t.shift()}}}function y(e,t){var r="";while(e.length>0&&!e[0].match(t)){r+=e.shift()}return r}function Ke(e){var t;if(e.length>0&&We.test(e[0])){e.shift();t=y(e,$e).trim();e.shift()}else{t=y(e,p)}return t}var Ye="input, textarea, select";function Qe(e){var t=te(e,"hx-trigger");var r=[];if(t){var n=Ge(t);do{y(n,ze);var i=n.length;var a=y(n,/[,\[\s]/);if(a!==""){if(a==="every"){var o={trigger:"every"};y(n,ze);o.pollInterval=d(y(n,/[,\[\s]/));y(n,ze);var s=Ze(e,n,"event");if(s){o.eventFilter=s}r.push(o)}else if(a.indexOf("sse:")===0){r.push({trigger:"sse",sseEvent:a.substr(4)})}else{var l={trigger:a};var s=Ze(e,n,"event");if(s){l.eventFilter=s}while(n.length>0&&n[0]!==","){y(n,ze);var u=n.shift();if(u==="changed"){l.changed=true}else if(u==="once"){l.once=true}else if(u==="consume"){l.consume=true}else if(u==="delay"&&n[0]===":"){n.shift();l.delay=d(y(n,p))}else if(u==="from"&&n[0]===":"){n.shift();if(We.test(n[0])){var f=Ke(n)}else{var f=y(n,p);if(f==="closest"||f==="find"||f==="next"||f==="previous"){n.shift();var c=Ke(n);if(c.length>0){f+=" "+c}}}l.from=f}else if(u==="target"&&n[0]===":"){n.shift();l.target=Ke(n)}else if(u==="throttle"&&n[0]===":"){n.shift();l.throttle=d(y(n,p))}else if(u==="queue"&&n[0]===":"){n.shift();l.queue=y(n,p)}else if(u==="root"&&n[0]===":"){n.shift();l[u]=Ke(n)}else if(u==="threshold"&&n[0]===":"){n.shift();l[u]=y(n,p)}else{fe(e,"htmx:syntax:error",{token:n.shift()})}}r.push(l)}}if(n.length===i){fe(e,"htmx:syntax:error",{token:n.shift()})}y(n,ze)}while(n[0]===","&&n.shift())}if(r.length>0){return r}else if(h(e,"form")){return[{trigger:"submit"}]}else if(h(e,'input[type="button"], input[type="submit"]')){return[{trigger:"click"}]}else if(h(e,Ye)){return[{trigger:"change"}]}else{return[{trigger:"click"}]}}function et(e){ae(e).cancelled=true}function tt(e,t,r){var n=ae(e);n.timeout=setTimeout(function(){if(se(e)&&n.cancelled!==true){if(!ot(r,e,Vt("hx:poll:trigger",{triggerSpec:r,target:e}))){t(e)}tt(e,t,r)}},r.pollInterval)}function rt(e){return location.hostname===e.hostname&&ee(e,"href")&&ee(e,"href").indexOf("#")!==0}function nt(t,r,e){if(t.tagName==="A"&&rt(t)&&(t.target===""||t.target==="_self")||t.tagName==="FORM"){r.boosted=true;var n,i;if(t.tagName==="A"){n="get";i=ee(t,"href")}else{var a=ee(t,"method");n=a?a.toLowerCase():"get";if(n==="get"){}i=ee(t,"action")}e.forEach(function(e){st(t,function(e,t){if(v(e,Q.config.disableSelector)){m(e);return}he(n,i,e,t)},r,e,true)})}}function it(e,t){if(e.type==="submit"||e.type==="click"){if(t.tagName==="FORM"){return true}if(h(t,'input[type="submit"], button')&&v(t,"form")!==null){return true}if(t.tagName==="A"&&t.href&&(t.getAttribute("href")==="#"||t.getAttribute("href").indexOf("#")!==0)){return true}}return false}function at(e,t){return ae(e).boosted&&e.tagName==="A"&&t.type==="click"&&(t.ctrlKey||t.metaKey)}function ot(e,t,r){var n=e.eventFilter;if(n){try{return n.call(t,r)!==true}catch(e){fe(re().body,"htmx:eventFilter:error",{error:e,source:n.source});return true}}return false}function st(a,o,e,s,l){var u=ae(a);var t;if(s.from){t=W(a,s.from)}else{t=[a]}if(s.changed){t.forEach(function(e){var t=ae(e);t.lastValue=e.value})}oe(t,function(n){var i=function(e){if(!se(a)){n.removeEventListener(s.trigger,i);return}if(at(a,e)){return}if(l||it(e,a)){e.preventDefault()}if(ot(s,a,e)){return}var t=ae(e);t.triggerSpec=s;if(t.handledFor==null){t.handledFor=[]}if(t.handledFor.indexOf(a)<0){t.handledFor.push(a);if(s.consume){e.stopPropagation()}if(s.target&&e.target){if(!h(e.target,s.target)){return}}if(s.once){if(u.triggeredOnce){return}else{u.triggeredOnce=true}}if(s.changed){var r=ae(n);if(r.lastValue===n.value){return}r.lastValue=n.value}if(u.delayed){clearTimeout(u.delayed)}if(u.throttle){return}if(s.throttle){if(!u.throttle){o(a,e);u.throttle=setTimeout(function(){u.throttle=null},s.throttle)}}else if(s.delay){u.delayed=setTimeout(function(){o(a,e)},s.delay)}else{ce(a,"htmx:trigger");o(a,e)}}};if(e.listenerInfos==null){e.listenerInfos=[]}e.listenerInfos.push({trigger:s.trigger,listener:i,on:n});n.addEventListener(s.trigger,i)})}var lt=false;var ut=null;function ft(){if(!ut){ut=function(){lt=true};window.addEventListener("scroll",ut);setInterval(function(){if(lt){lt=false;oe(re().querySelectorAll("[hx-trigger='revealed'],[data-hx-trigger='revealed']"),function(e){ct(e)})}},200)}}function ct(t){if(!o(t,"data-hx-revealed")&&k(t)){t.setAttribute("data-hx-revealed","true");var e=ae(t);if(e.initHash){ce(t,"revealed")}else{t.addEventListener("htmx:afterProcessNode",function(e){ce(t,"revealed")},{once:true})}}}function ht(e,t,r){var n=P(r);for(var i=0;i<n.length;i++){var a=n[i].split(/:(.+)/);if(a[0]==="connect"){vt(e,a[1],0)}if(a[0]==="send"){gt(e)}}}function vt(s,r,n){if(!se(s)){return}if(r.indexOf("/")==0){var e=location.hostname+(location.port?":"+location.port:"");if(location.protocol=="https:"){r="wss://"+e+r}else if(location.protocol=="http:"){r="ws://"+e+r}}var t=Q.createWebSocket(r);t.onerror=function(e){fe(s,"htmx:wsError",{error:e,socket:t});dt(s)};t.onclose=function(e){if([1006,1012,1013].indexOf(e.code)>=0){var t=mt(n);setTimeout(function(){vt(s,r,n+1)},t)}};t.onopen=function(e){n=0};ae(s).webSocket=t;t.addEventListener("message",function(e){if(dt(s)){return}var t=e.data;T(s,function(e){t=e.transformResponse(t,null,s)});var r=R(s);var n=l(t);var i=I(n.children);for(var a=0;a<i.length;a++){var o=i[a];xe(te(o,"hx-swap-oob")||"true",o,r)}Yt(r.tasks)})}function dt(e){if(!se(e)){ae(e).webSocket.close();return true}}function gt(u){var f=c(u,function(e){return ae(e).webSocket!=null});if(f){u.addEventListener(Qe(u)[0].trigger,function(e){var t=ae(f).webSocket;var r=vr(u,f);var n=ur(u,"post");var i=n.errors;var a=n.values;var o=Cr(u);var s=le(a,o);var l=dr(s,u);l["HEADERS"]=r;if(i&&i.length>0){ce(u,"htmx:validation:halted",i);return}t.send(JSON.stringify(l));if(it(e,u)){e.preventDefault()}})}else{fe(u,"htmx:noWebSocketSourceError")}}function mt(e){var t=Q.config.wsReconnectDelay;if(typeof t==="function"){return t(e)}if(t==="full-jitter"){var r=Math.min(e,6);var n=1e3*Math.pow(2,r);return n*Math.random()}x('htmx.config.wsReconnectDelay must either be a function or the string "full-jitter"')}function pt(e,t,r){var n=P(r);for(var i=0;i<n.length;i++){var a=n[i].split(/:(.+)/);if(a[0]==="connect"){yt(e,a[1])}if(a[0]==="swap"){xt(e,a[1])}}}function yt(t,e){var r=Q.createEventSource(e);r.onerror=function(e){fe(t,"htmx:sseError",{error:e,source:r});wt(t)};ae(t).sseEventSource=r}function xt(a,o){var s=c(a,St);if(s){var l=ae(s).sseEventSource;var u=function(e){if(wt(s)){return}if(!se(a)){l.removeEventListener(o,u);return}var t=e.data;T(a,function(e){t=e.transformResponse(t,null,a)});var r=mr(a);var n=ge(a);var i=R(a);Ue(r.swapStyle,n,a,t,i);Yt(i.tasks);ce(a,"htmx:sseMessage",e)};ae(a).sseListener=u;l.addEventListener(o,u)}else{fe(a,"htmx:noSSESourceError")}}function bt(e,t,r){var n=c(e,St);if(n){var i=ae(n).sseEventSource;var a=function(){if(!wt(n)){if(se(e)){t(e)}else{i.removeEventListener(r,a)}}};ae(e).sseListener=a;i.addEventListener(r,a)}else{fe(e,"htmx:noSSESourceError")}}function wt(e){if(!se(e)){ae(e).sseEventSource.close();return true}}function St(e){return ae(e).sseEventSource!=null}function Et(e,t,r,n){var i=function(){if(!r.loaded){r.loaded=true;t(e)}};if(n){setTimeout(i,n)}else{i()}}function Ct(t,i,e){var a=false;oe(b,function(r){if(o(t,"hx-"+r)){var n=te(t,"hx-"+r);a=true;i.path=n;i.verb=r;e.forEach(function(e){Tt(t,e,i,function(e,t){if(v(e,Q.config.disableSelector)){m(e);return}he(r,n,e,t)})})}});return a}function Tt(n,e,t,r){if(e.sseEvent){bt(n,r,e.sseEvent)}else if(e.trigger==="revealed"){ft();st(n,r,t,e);ct(n)}else if(e.trigger==="intersect"){var i={};if(e.root){i.root=ue(n,e.root)}if(e.threshold){i.threshold=parseFloat(e.threshold)}var a=new IntersectionObserver(function(e){for(var t=0;t<e.length;t++){var r=e[t];if(r.isIntersecting){ce(n,"intersect");break}}},i);a.observe(n);st(n,r,t,e)}else if(e.trigger==="load"){if(!ot(e,n,Vt("load",{elt:n}))){Et(n,r,t,e.delay)}}else if(e.pollInterval){t.polling=true;tt(n,r,e)}else{st(n,r,t,e)}}function Rt(e){if(Q.config.allowScriptTags&&(e.type==="text/javascript"||e.type==="module"||e.type==="")){var t=re().createElement("script");oe(e.attributes,function(e){t.setAttribute(e.name,e.value)});t.textContent=e.textContent;t.async=false;if(Q.config.inlineScriptNonce){t.nonce=Q.config.inlineScriptNonce}var r=e.parentElement;try{r.insertBefore(t,e)}catch(e){x(e)}finally{if(e.parentElement){e.parentElement.removeChild(e)}}}}function Ot(e){if(h(e,"script")){Rt(e)}oe(f(e,"script"),function(e){Rt(e)})}function qt(){return document.querySelector("[hx-boost], [data-hx-boost]")}function Ht(e){var t=null;var r=[];if(document.evaluate){var n=document.evaluate('//*[@*[ starts-with(name(), "hx-on:") or starts-with(name(), "data-hx-on:") ]]',e);while(t=n.iterateNext())r.push(t)}else{var i=document.getElementsByTagName("*");for(var a=0;a<i.length;a++){var o=i[a].attributes;for(var s=0;s<o.length;s++){var l=o[s].name;if(g(l,"hx-on:")||g(l,"data-hx-on:")){r.push(i[a])}}}}return r}function Lt(e){if(e.querySelectorAll){var t=qt()?", a":"";var r=e.querySelectorAll(w+t+", form, [type='submit'], [hx-sse], [data-hx-sse], [hx-ws],"+" [data-hx-ws], [hx-ext], [data-hx-ext], [hx-trigger], [data-hx-trigger], [hx-on], [data-hx-on]");return r}else{return[]}}function At(e){var t=v(e.target,"button, input[type='submit']");var r=It(e);if(r){r.lastButtonClicked=t}}function Nt(e){var t=It(e);if(t){t.lastButtonClicked=null}}function It(e){var t=v(e.target,"button, input[type='submit']");if(!t){return}var r=s("#"+ee(t,"form"))||v(t,"form");if(!r){return}return ae(r)}function kt(e){e.addEventListener("click",At);e.addEventListener("focusin",At);e.addEventListener("focusout",Nt)}function Pt(e){var t=Ge(e);var r=0;for(let e=0;e<t.length;e++){const n=t[e];if(n==="{"){r++}else if(n==="}"){r--}}return r}function Mt(t,e,r){var n=ae(t);if(!Array.isArray(n.onHandlers)){n.onHandlers=[]}var i;var a=function(e){return wr(t,function(){if(!i){i=new Function("event",r)}i.call(t,e)})};t.addEventListener(e,a);n.onHandlers.push({event:e,listener:a})}function Dt(e){var t=te(e,"hx-on");if(t){var r={};var n=t.split("\n");var i=null;var a=0;while(n.length>0){var o=n.shift();var s=o.match(/^\s*([a-zA-Z:\-\.]+:)(.*)/);if(a===0&&s){o.split(":");i=s[1].slice(0,-1);r[i]=s[2]}else{r[i]+=o}a+=Pt(o)}for(var l in r){Mt(e,l,r[l])}}}function Xt(t){Oe(t);for(var e=0;e<t.attributes.length;e++){var r=t.attributes[e].name;var n=t.attributes[e].value;if(g(r,"hx-on:")||g(r,"data-hx-on:")){let e=r.slice(r.indexOf(":")+1);if(g(e,":"))e="htmx"+e;Mt(t,e,n)}}}function Ut(t){if(v(t,Q.config.disableSelector)){m(t);return}var r=ae(t);if(r.initHash!==Re(t)){qe(t);r.initHash=Re(t);Dt(t);ce(t,"htmx:beforeProcessNode");if(t.value){r.lastValue=t.value}var e=Qe(t);var n=Ct(t,r,e);if(!n){if(ne(t,"hx-boost")==="true"){nt(t,r,e)}else if(o(t,"hx-trigger")){e.forEach(function(e){Tt(t,e,r,function(){})})}}if(t.tagName==="FORM"||ee(t,"type")==="submit"&&o(t,"form")){kt(t)}var i=te(t,"hx-sse");if(i){pt(t,r,i)}var a=te(t,"hx-ws");if(a){ht(t,r,a)}ce(t,"htmx:afterProcessNode")}}function Bt(e){e=s(e);if(v(e,Q.config.disableSelector)){m(e);return}Ut(e);oe(Lt(e),function(e){Ut(e)});oe(Ht(e),Xt)}function Ft(e){return e.replace(/([a-z0-9])([A-Z])/g,"$1-$2").toLowerCase()}function Vt(e,t){var r;if(window.CustomEvent&&typeof window.CustomEvent==="function"){r=new CustomEvent(e,{bubbles:true,cancelable:true,detail:t})}else{r=re().createEvent("CustomEvent");r.initCustomEvent(e,true,true,t)}return r}function fe(e,t,r){ce(e,t,le({error:t},r))}function jt(e){return e==="htmx:afterProcessNode"}function T(e,t){oe(Mr(e),function(e){try{t(e)}catch(e){x(e)}})}function x(e){if(console.error){console.error(e)}else if(console.log){console.log("ERROR: ",e)}}function ce(e,t,r){e=s(e);if(r==null){r={}}r["elt"]=e;var n=Vt(t,r);if(Q.logger&&!jt(t)){Q.logger(e,t,r)}if(r.error){x(r.error);ce(e,"htmx:error",{errorInfo:r})}var i=e.dispatchEvent(n);var a=Ft(t);if(i&&a!==t){var o=Vt(a,n.detail);i=i&&e.dispatchEvent(o)}T(e,function(e){i=i&&(e.onEvent(t,n)!==false&&!n.defaultPrevented)});return i}var _t=location.pathname+location.search;function zt(){var e=re().querySelector("[hx-history-elt],[data-hx-history-elt]");return e||re().body}function Wt(e,t,r,n){if(!M()){return}if(Q.config.historyCacheSize<=0){localStorage.removeItem("htmx-history-cache");return}e=D(e);var i=E(localStorage.getItem("htmx-history-cache"))||[];for(var a=0;a<i.length;a++){if(i[a].url===e){i.splice(a,1);break}}var o={url:e,content:t,title:r,scroll:n};ce(re().body,"htmx:historyItemCreated",{item:o,cache:i});i.push(o);while(i.length>Q.config.historyCacheSize){i.shift()}while(i.length>0){try{localStorage.setItem("htmx-history-cache",JSON.stringify(i));break}catch(e){fe(re().body,"htmx:historyCacheError",{cause:e,cache:i});i.shift()}}}function $t(e){if(!M()){return null}e=D(e);var t=E(localStorage.getItem("htmx-history-cache"))||[];for(var r=0;r<t.length;r++){if(t[r].url===e){return t[r]}}return null}function Gt(e){var t=Q.config.requestClass;var r=e.cloneNode(true);oe(f(r,"."+t),function(e){n(e,t)});return r.innerHTML}function Jt(){var e=zt();var t=_t||location.pathname+location.search;var r;try{r=re().querySelector('[hx-history="false" i],[data-hx-history="false" i]')}catch(e){r=re().querySelector('[hx-history="false"],[data-hx-history="false"]')}if(!r){ce(re().body,"htmx:beforeHistorySave",{path:t,historyElt:e});Wt(t,Gt(e),re().title,window.scrollY)}if(Q.config.historyEnabled)history.replaceState({htmx:true},re().title,window.location.href)}function Zt(e){if(Q.config.getCacheBusterParam){e=e.replace(/org\.htmx\.cache-buster=[^&]*&?/,"");if(_(e,"&")||_(e,"?")){e=e.slice(0,-1)}}if(Q.config.historyEnabled){history.pushState({htmx:true},"",e)}_t=e}function Kt(e){if(Q.config.historyEnabled)history.replaceState({htmx:true},"",e);_t=e}function Yt(e){oe(e,function(e){e.call()})}function Qt(a){var e=new XMLHttpRequest;var o={path:a,xhr:e};ce(re().body,"htmx:historyCacheMiss",o);e.open("GET",a,true);e.setRequestHeader("HX-History-Restore-Request","true");e.onload=function(){if(this.status>=200&&this.status<400){ce(re().body,"htmx:historyCacheMissLoad",o);var e=l(this.response);e=e.querySelector("[hx-history-elt],[data-hx-history-elt]")||e;var t=zt();var r=R(t);var n=Xe(this.response);if(n){var i=C("title");if(i){i.innerHTML=n}else{window.document.title=n}}Pe(t,e,r);Yt(r.tasks);_t=a;ce(re().body,"htmx:historyRestore",{path:a,cacheMiss:true,serverResponse:this.response})}else{fe(re().body,"htmx:historyCacheMissLoadError",o)}};e.send()}function er(e){Jt();e=e||location.pathname+location.search;var t=$t(e);if(t){var r=l(t.content);var n=zt();var i=R(n);Pe(n,r,i);Yt(i.tasks);document.title=t.title;setTimeout(function(){window.scrollTo(0,t.scroll)},0);_t=e;ce(re().body,"htmx:historyRestore",{path:e,item:t})}else{if(Q.config.refreshOnHistoryMiss){window.location.reload(true)}else{Qt(e)}}}function tr(e){var t=Y(e,"hx-indicator");if(t==null){t=[e]}oe(t,function(e){var t=ae(e);t.requestCount=(t.requestCount||0)+1;e.classList["add"].call(e.classList,Q.config.requestClass)});return t}function rr(e){var t=Y(e,"hx-disabled-elt");if(t==null){t=[]}oe(t,function(e){var t=ae(e);t.requestCount=(t.requestCount||0)+1;e.setAttribute("disabled","")});return t}function nr(e,t){oe(e,function(e){var t=ae(e);t.requestCount=(t.requestCount||0)-1;if(t.requestCount===0){e.classList["remove"].call(e.classList,Q.config.requestClass)}});oe(t,function(e){var t=ae(e);t.requestCount=(t.requestCount||0)-1;if(t.requestCount===0){e.removeAttribute("disabled")}})}function ir(e,t){for(var r=0;r<e.length;r++){var n=e[r];if(n.isSameNode(t)){return true}}return false}function ar(e){if(e.name===""||e.name==null||e.disabled){return false}if(e.type==="button"||e.type==="submit"||e.tagName==="image"||e.tagName==="reset"||e.tagName==="file"){return false}if(e.type==="checkbox"||e.type==="radio"){return e.checked}return true}function or(e,t,r){if(e!=null&&t!=null){var n=r[e];if(n===undefined){r[e]=t}else if(Array.isArray(n)){if(Array.isArray(t)){r[e]=n.concat(t)}else{n.push(t)}}else{if(Array.isArray(t)){r[e]=[n].concat(t)}else{r[e]=[n,t]}}}}function sr(t,r,n,e,i){if(e==null||ir(t,e)){return}else{t.push(e)}if(ar(e)){var a=ee(e,"name");var o=e.value;if(e.multiple&&e.tagName==="SELECT"){o=I(e.querySelectorAll("option:checked")).map(function(e){return e.value})}if(e.files){o=I(e.files)}or(a,o,r);if(i){lr(e,n)}}if(h(e,"form")){var s=e.elements;oe(s,function(e){sr(t,r,n,e,i)})}}function lr(e,t){if(e.willValidate){ce(e,"htmx:validation:validate");if(!e.checkValidity()){t.push({elt:e,message:e.validationMessage,validity:e.validity});ce(e,"htmx:validation:failed",{message:e.validationMessage,validity:e.validity})}}}function ur(e,t){var r=[];var n={};var i={};var a=[];var o=ae(e);if(o.lastButtonClicked&&!se(o.lastButtonClicked)){o.lastButtonClicked=null}var s=h(e,"form")&&e.noValidate!==true||te(e,"hx-validate")==="true";if(o.lastButtonClicked){s=s&&o.lastButtonClicked.formNoValidate!==true}if(t!=="get"){sr(r,i,a,v(e,"form"),s)}sr(r,n,a,e,s);if(o.lastButtonClicked||e.tagName==="BUTTON"||e.tagName==="INPUT"&&ee(e,"type")==="submit"){var l=o.lastButtonClicked||e;var u=ee(l,"name");or(u,l.value,i)}var f=Y(e,"hx-include");oe(f,function(e){sr(r,n,a,e,s);if(!h(e,"form")){oe(e.querySelectorAll(Ye),function(e){sr(r,n,a,e,s)})}});n=le(n,i);return{errors:a,values:n}}function fr(e,t,r){if(e!==""){e+="&"}if(String(r)==="[object Object]"){r=JSON.stringify(r)}var n=encodeURIComponent(r);e+=encodeURIComponent(t)+"="+n;return e}function cr(e){var t="";for(var r in e){if(e.hasOwnProperty(r)){var n=e[r];if(Array.isArray(n)){oe(n,function(e){t=fr(t,r,e)})}else{t=fr(t,r,n)}}}return t}function hr(e){var t=new FormData;for(var r in e){if(e.hasOwnProperty(r)){var n=e[r];if(Array.isArray(n)){oe(n,function(e){t.append(r,e)})}else{t.append(r,n)}}}return t}function vr(e,t,r){var n={"HX-Request":"true","HX-Trigger":ee(e,"id"),"HX-Trigger-Name":ee(e,"name"),"HX-Target":te(t,"id"),"HX-Current-URL":re().location.href};br(e,"hx-headers",false,n);if(r!==undefined){n["HX-Prompt"]=r}if(ae(e).boosted){n["HX-Boosted"]="true"}return n}function dr(t,e){var r=ne(e,"hx-params");if(r){if(r==="none"){return{}}else if(r==="*"){return t}else if(r.indexOf("not ")===0){oe(r.substr(4).split(","),function(e){e=e.trim();delete t[e]});return t}else{var n={};oe(r.split(","),function(e){e=e.trim();n[e]=t[e]});return n}}else{return t}}function gr(e){return ee(e,"href")&&ee(e,"href").indexOf("#")>=0}function mr(e,t){var r=t?t:ne(e,"hx-swap");var n={swapStyle:ae(e).boosted?"innerHTML":Q.config.defaultSwapStyle,swapDelay:Q.config.defaultSwapDelay,settleDelay:Q.config.defaultSettleDelay};if(Q.config.scrollIntoViewOnBoost&&ae(e).boosted&&!gr(e)){n["show"]="top"}if(r){var i=P(r);if(i.length>0){for(var a=0;a<i.length;a++){var o=i[a];if(o.indexOf("swap:")===0){n["swapDelay"]=d(o.substr(5))}else if(o.indexOf("settle:")===0){n["settleDelay"]=d(o.substr(7))}else if(o.indexOf("transition:")===0){n["transition"]=o.substr(11)==="true"}else if(o.indexOf("ignoreTitle:")===0){n["ignoreTitle"]=o.substr(12)==="true"}else if(o.indexOf("scroll:")===0){var s=o.substr(7);var l=s.split(":");var u=l.pop();var f=l.length>0?l.join(":"):null;n["scroll"]=u;n["scrollTarget"]=f}else if(o.indexOf("show:")===0){var c=o.substr(5);var l=c.split(":");var h=l.pop();var f=l.length>0?l.join(":"):null;n["show"]=h;n["showTarget"]=f}else if(o.indexOf("focus-scroll:")===0){var v=o.substr("focus-scroll:".length);n["focusScroll"]=v=="true"}else if(a==0){n["swapStyle"]=o}else{x("Unknown modifier in hx-swap: "+o)}}}}return n}function pr(e){return ne(e,"hx-encoding")==="multipart/form-data"||h(e,"form")&&ee(e,"enctype")==="multipart/form-data"}function yr(t,r,n){var i=null;T(r,function(e){if(i==null){i=e.encodeParameters(t,n,r)}});if(i!=null){return i}else{if(pr(r)){return hr(n)}else{return cr(n)}}}function R(e){return{tasks:[],elts:[e]}}function xr(e,t){var r=e[0];var n=e[e.length-1];if(t.scroll){var i=null;if(t.scrollTarget){i=ue(r,t.scrollTarget)}if(t.scroll==="top"&&(r||i)){i=i||r;i.scrollTop=0}if(t.scroll==="bottom"&&(n||i)){i=i||n;i.scrollTop=i.scrollHeight}}if(t.show){var i=null;if(t.showTarget){var a=t.showTarget;if(t.showTarget==="window"){a="body"}i=ue(r,a)}if(t.show==="top"&&(r||i)){i=i||r;i.scrollIntoView({block:"start",behavior:Q.config.scrollBehavior})}if(t.show==="bottom"&&(n||i)){i=i||n;i.scrollIntoView({block:"end",behavior:Q.config.scrollBehavior})}}}function br(e,t,r,n){if(n==null){n={}}if(e==null){return n}var i=te(e,t);if(i){var a=i.trim();var o=r;if(a==="unset"){return null}if(a.indexOf("javascript:")===0){a=a.substr(11);o=true}else if(a.indexOf("js:")===0){a=a.substr(3);o=true}if(a.indexOf("{")!==0){a="{"+a+"}"}var s;if(o){s=wr(e,function(){return Function("return ("+a+")")()},{})}else{s=E(a)}for(var l in s){if(s.hasOwnProperty(l)){if(n[l]==null){n[l]=s[l]}}}}return br(u(e),t,r,n)}function wr(e,t,r){if(Q.config.allowEval){return t()}else{fe(e,"htmx:evalDisallowedError");return r}}function Sr(e,t){return br(e,"hx-vars",true,t)}function Er(e,t){return br(e,"hx-vals",false,t)}function Cr(e){return le(Sr(e),Er(e))}function Tr(t,r,n){if(n!==null){try{t.setRequestHeader(r,n)}catch(e){t.setRequestHeader(r,encodeURIComponent(n));t.setRequestHeader(r+"-URI-AutoEncoded","true")}}}function Rr(t){if(t.responseURL&&typeof URL!=="undefined"){try{var e=new URL(t.responseURL);return e.pathname+e.search}catch(e){fe(re().body,"htmx:badResponseUrl",{url:t.responseURL})}}}function O(e,t){return e.getAllResponseHeaders().match(t)}function Or(e,t,r){e=e.toLowerCase();if(r){if(r instanceof Element||L(r,"String")){return he(e,t,null,null,{targetOverride:s(r),returnPromise:true})}else{return he(e,t,s(r.source),r.event,{handler:r.handler,headers:r.headers,values:r.values,targetOverride:s(r.target),swapOverride:r.swap,select:r.select,returnPromise:true})}}else{return he(e,t,null,null,{returnPromise:true})}}function qr(e){var t=[];while(e){t.push(e);e=e.parentElement}return t}function Hr(e,t,r){var n;var i;if(typeof URL==="function"){i=new URL(t,document.location.href);var a=document.location.origin;n=a===i.origin}else{i=t;n=g(t,document.location.origin)}if(Q.config.selfRequestsOnly){if(!n){return false}}return ce(e,"htmx:validateUrl",le({url:i,sameHost:n},r))}function he(t,r,n,i,a,e){var o=null;var s=null;a=a!=null?a:{};if(a.returnPromise&&typeof Promise!=="undefined"){var l=new Promise(function(e,t){o=e;s=t})}if(n==null){n=re().body}var M=a.handler||Ar;var D=a.select||null;if(!se(n)){ie(o);return l}var u=a.targetOverride||ge(n);if(u==null||u==ve){fe(n,"htmx:targetError",{target:te(n,"hx-target")});ie(s);return l}var f=ae(n);var c=f.lastButtonClicked;if(c){var h=ee(c,"formaction");if(h!=null){r=h}var v=ee(c,"formmethod");if(v!=null){if(v.toLowerCase()!=="dialog"){t=v}}}var d=ne(n,"hx-confirm");if(e===undefined){var X=function(e){return he(t,r,n,i,a,!!e)};var U={target:u,elt:n,path:r,verb:t,triggeringEvent:i,etc:a,issueRequest:X,question:d};if(ce(n,"htmx:confirm",U)===false){ie(o);return l}}var g=n;var m=ne(n,"hx-sync");var p=null;var y=false;if(m){var B=m.split(":");var F=B[0].trim();if(F==="this"){g=de(n,"hx-sync")}else{g=ue(n,F)}m=(B[1]||"drop").trim();f=ae(g);if(m==="drop"&&f.xhr&&f.abortable!==true){ie(o);return l}else if(m==="abort"){if(f.xhr){ie(o);return l}else{y=true}}else if(m==="replace"){ce(g,"htmx:abort")}else if(m.indexOf("queue")===0){var V=m.split(" ");p=(V[1]||"last").trim()}}if(f.xhr){if(f.abortable){ce(g,"htmx:abort")}else{if(p==null){if(i){var x=ae(i);if(x&&x.triggerSpec&&x.triggerSpec.queue){p=x.triggerSpec.queue}}if(p==null){p="last"}}if(f.queuedRequests==null){f.queuedRequests=[]}if(p==="first"&&f.queuedRequests.length===0){f.queuedRequests.push(function(){he(t,r,n,i,a)})}else if(p==="all"){f.queuedRequests.push(function(){he(t,r,n,i,a)})}else if(p==="last"){f.queuedRequests=[];f.queuedRequests.push(function(){he(t,r,n,i,a)})}ie(o);return l}}var b=new XMLHttpRequest;f.xhr=b;f.abortable=y;var w=function(){f.xhr=null;f.abortable=false;if(f.queuedRequests!=null&&f.queuedRequests.length>0){var e=f.queuedRequests.shift();e()}};var j=ne(n,"hx-prompt");if(j){var S=prompt(j);if(S===null||!ce(n,"htmx:prompt",{prompt:S,target:u})){ie(o);w();return l}}if(d&&!e){if(!confirm(d)){ie(o);w();return l}}var E=vr(n,u,S);if(t!=="get"&&!pr(n)){E["Content-Type"]="application/x-www-form-urlencoded"}if(a.headers){E=le(E,a.headers)}var _=ur(n,t);var C=_.errors;var T=_.values;if(a.values){T=le(T,a.values)}var z=Cr(n);var W=le(T,z);var R=dr(W,n);if(Q.config.getCacheBusterParam&&t==="get"){R["org.htmx.cache-buster"]=ee(u,"id")||"true"}if(r==null||r===""){r=re().location.href}var O=br(n,"hx-request");var $=ae(n).boosted;var q=Q.config.methodsThatUseUrlParams.indexOf(t)>=0;var H={boosted:$,useUrlParams:q,parameters:R,unfilteredParameters:W,headers:E,target:u,verb:t,errors:C,withCredentials:a.credentials||O.credentials||Q.config.withCredentials,timeout:a.timeout||O.timeout||Q.config.timeout,path:r,triggeringEvent:i};if(!ce(n,"htmx:configRequest",H)){ie(o);w();return l}r=H.path;t=H.verb;E=H.headers;R=H.parameters;C=H.errors;q=H.useUrlParams;if(C&&C.length>0){ce(n,"htmx:validation:halted",H);ie(o);w();return l}var G=r.split("#");var J=G[0];var L=G[1];var A=r;if(q){A=J;var Z=Object.keys(R).length!==0;if(Z){if(A.indexOf("?")<0){A+="?"}else{A+="&"}A+=cr(R);if(L){A+="#"+L}}}if(!Hr(n,A,H)){fe(n,"htmx:invalidPath",H);ie(s);return l}b.open(t.toUpperCase(),A,true);b.overrideMimeType("text/html");b.withCredentials=H.withCredentials;b.timeout=H.timeout;if(O.noHeaders){}else{for(var N in E){if(E.hasOwnProperty(N)){var K=E[N];Tr(b,N,K)}}}var I={xhr:b,target:u,requestConfig:H,etc:a,boosted:$,select:D,pathInfo:{requestPath:r,finalRequestPath:A,anchor:L}};b.onload=function(){try{var e=qr(n);I.pathInfo.responsePath=Rr(b);M(n,I);nr(k,P);ce(n,"htmx:afterRequest",I);ce(n,"htmx:afterOnLoad",I);if(!se(n)){var t=null;while(e.length>0&&t==null){var r=e.shift();if(se(r)){t=r}}if(t){ce(t,"htmx:afterRequest",I);ce(t,"htmx:afterOnLoad",I)}}ie(o);w()}catch(e){fe(n,"htmx:onLoadError",le({error:e},I));throw e}};b.onerror=function(){nr(k,P);fe(n,"htmx:afterRequest",I);fe(n,"htmx:sendError",I);ie(s);w()};b.onabort=function(){nr(k,P);fe(n,"htmx:afterRequest",I);fe(n,"htmx:sendAbort",I);ie(s);w()};b.ontimeout=function(){nr(k,P);fe(n,"htmx:afterRequest",I);fe(n,"htmx:timeout",I);ie(s);w()};if(!ce(n,"htmx:beforeRequest",I)){ie(o);w();return l}var k=tr(n);var P=rr(n);oe(["loadstart","loadend","progress","abort"],function(t){oe([b,b.upload],function(e){e.addEventListener(t,function(e){ce(n,"htmx:xhr:"+t,{lengthComputable:e.lengthComputable,loaded:e.loaded,total:e.total})})})});ce(n,"htmx:beforeSend",I);var Y=q?null:yr(b,n,R);b.send(Y);return l}function Lr(e,t){var r=t.xhr;var n=null;var i=null;if(O(r,/HX-Push:/i)){n=r.getResponseHeader("HX-Push");i="push"}else if(O(r,/HX-Push-Url:/i)){n=r.getResponseHeader("HX-Push-Url");i="push"}else if(O(r,/HX-Replace-Url:/i)){n=r.getResponseHeader("HX-Replace-Url");i="replace"}if(n){if(n==="false"){return{}}else{return{type:i,path:n}}}var a=t.pathInfo.finalRequestPath;var o=t.pathInfo.responsePath;var s=ne(e,"hx-push-url");var l=ne(e,"hx-replace-url");var u=ae(e).boosted;var f=null;var c=null;if(s){f="push";c=s}else if(l){f="replace";c=l}else if(u){f="push";c=o||a}if(c){if(c==="false"){return{}}if(c==="true"){c=o||a}if(t.pathInfo.anchor&&c.indexOf("#")===-1){c=c+"#"+t.pathInfo.anchor}return{type:f,path:c}}else{return{}}}function Ar(l,u){var f=u.xhr;var c=u.target;var e=u.etc;var t=u.requestConfig;var h=u.select;if(!ce(l,"htmx:beforeOnLoad",u))return;if(O(f,/HX-Trigger:/i)){Be(f,"HX-Trigger",l)}if(O(f,/HX-Location:/i)){Jt();var r=f.getResponseHeader("HX-Location");var v;if(r.indexOf("{")===0){v=E(r);r=v["path"];delete v["path"]}Or("GET",r,v).then(function(){Zt(r)});return}var n=O(f,/HX-Refresh:/i)&&"true"===f.getResponseHeader("HX-Refresh");if(O(f,/HX-Redirect:/i)){location.href=f.getResponseHeader("HX-Redirect");n&&location.reload();return}if(n){location.reload();return}if(O(f,/HX-Retarget:/i)){u.target=re().querySelector(f.getResponseHeader("HX-Retarget"))}var d=Lr(l,u);var i=f.status>=200&&f.status<400&&f.status!==204;var g=f.response;var a=f.status>=400;var m=Q.config.ignoreTitle;var o=le({shouldSwap:i,serverResponse:g,isError:a,ignoreTitle:m},u);if(!ce(c,"htmx:beforeSwap",o))return;c=o.target;g=o.serverResponse;a=o.isError;m=o.ignoreTitle;u.target=c;u.failed=a;u.successful=!a;if(o.shouldSwap){if(f.status===286){et(l)}T(l,function(e){g=e.transformResponse(g,f,l)});if(d.type){Jt()}var s=e.swapOverride;if(O(f,/HX-Reswap:/i)){s=f.getResponseHeader("HX-Reswap")}var v=mr(l,s);if(v.hasOwnProperty("ignoreTitle")){m=v.ignoreTitle}c.classList.add(Q.config.swappingClass);var p=null;var y=null;var x=function(){try{var e=document.activeElement;var t={};try{t={elt:e,start:e?e.selectionStart:null,end:e?e.selectionEnd:null}}catch(e){}var r;if(h){r=h}if(O(f,/HX-Reselect:/i)){r=f.getResponseHeader("HX-Reselect")}if(d.type){ce(re().body,"htmx:beforeHistoryUpdate",le({history:d},u));if(d.type==="push"){Zt(d.path);ce(re().body,"htmx:pushedIntoHistory",{path:d.path})}else{Kt(d.path);ce(re().body,"htmx:replacedInHistory",{path:d.path})}}var n=R(c);Ue(v.swapStyle,c,l,g,n,r);if(t.elt&&!se(t.elt)&&ee(t.elt,"id")){var i=document.getElementById(ee(t.elt,"id"));var a={preventScroll:v.focusScroll!==undefined?!v.focusScroll:!Q.config.defaultFocusScroll};if(i){if(t.start&&i.setSelectionRange){try{i.setSelectionRange(t.start,t.end)}catch(e){}}i.focus(a)}}c.classList.remove(Q.config.swappingClass);oe(n.elts,function(e){if(e.classList){e.classList.add(Q.config.settlingClass)}ce(e,"htmx:afterSwap",u)});if(O(f,/HX-Trigger-After-Swap:/i)){var o=l;if(!se(l)){o=re().body}Be(f,"HX-Trigger-After-Swap",o)}var s=function(){oe(n.tasks,function(e){e.call()});oe(n.elts,function(e){if(e.classList){e.classList.remove(Q.config.settlingClass)}ce(e,"htmx:afterSettle",u)});if(u.pathInfo.anchor){var e=re().getElementById(u.pathInfo.anchor);if(e){e.scrollIntoView({block:"start",behavior:"auto"})}}if(n.title&&!m){var t=C("title");if(t){t.innerHTML=n.title}else{window.document.title=n.title}}xr(n.elts,v);if(O(f,/HX-Trigger-After-Settle:/i)){var r=l;if(!se(l)){r=re().body}Be(f,"HX-Trigger-After-Settle",r)}ie(p)};if(v.settleDelay>0){setTimeout(s,v.settleDelay)}else{s()}}catch(e){fe(l,"htmx:swapError",u);ie(y);throw e}};var b=Q.config.globalViewTransitions;if(v.hasOwnProperty("transition")){b=v.transition}if(b&&ce(l,"htmx:beforeTransition",u)&&typeof Promise!=="undefined"&&document.startViewTransition){var w=new Promise(function(e,t){p=e;y=t});var S=x;x=function(){document.startViewTransition(function(){S();return w})}}if(v.swapDelay>0){setTimeout(x,v.swapDelay)}else{x()}}if(a){fe(l,"htmx:responseError",le({error:"Response Status Error Code "+f.status+" from "+u.pathInfo.requestPath},u))}}var Nr={};function Ir(){return{init:function(e){return null},onEvent:function(e,t){return true},transformResponse:function(e,t,r){return e},isInlineSwap:function(e){return false},handleSwap:function(e,t,r,n){return false},encodeParameters:function(e,t,r){return null}}}function kr(e,t){if(t.init){t.init(r)}Nr[e]=le(Ir(),t)}function Pr(e){delete Nr[e]}function Mr(e,r,n){if(e==undefined){return r}if(r==undefined){r=[]}if(n==undefined){n=[]}var t=te(e,"hx-ext");if(t){oe(t.split(","),function(e){e=e.replace(/ /g,"");if(e.slice(0,7)=="ignore:"){n.push(e.slice(7));return}if(n.indexOf(e)<0){var t=Nr[e];if(t&&r.indexOf(t)<0){r.push(t)}}})}return Mr(u(e),r,n)}function Dr(e){var t=function(){if(!e)return;e();e=null};if(re().readyState==="complete"){t()}else{re().addEventListener("DOMContentLoaded",function(){t()});re().addEventListener("readystatechange",function(){if(re().readyState!=="complete")return;t()})}}function Xr(){if(Q.config.includeIndicatorStyles!==false){re().head.insertAdjacentHTML("beforeend","<style>                      ."+Q.config.indicatorClass+"{opacity:0}                      ."+Q.config.requestClass+" ."+Q.config.indicatorClass+"{opacity:1; transition: opacity 200ms ease-in;}                      ."+Q.config.requestClass+"."+Q.config.indicatorClass+"{opacity:1; transition: opacity 200ms ease-in;}                    </style>")}}function Ur(){var e=re().querySelector('meta[name="htmx-config"]');if(e){return E(e.content)}else{return null}}function Br(){var e=Ur();if(e){Q.config=le(Q.config,e)}}Dr(function(){Br();Xr();var e=re().body;Bt(e);var t=re().querySelectorAll("[hx-trigger='restored'],[data-hx-trigger='restored']");e.addEventListener("htmx:abort",function(e){var t=e.target;var r=ae(t);if(r&&r.xhr){r.xhr.abort()}});var r=window.onpopstate;window.onpopstate=function(e){if(e.state&&e.state.htmx){er();oe(t,function(e){ce(e,"htmx:restored",{document:re(),triggerEvent:ce})})}else{if(r){r(e)}}};setTimeout(function(){ce(e,"htmx:load",{});e=null},0)});return Q}()});
        </script>
    </head>

    <body>
    <header>
        <form action="${root_url}/search" method="GET" style="width:100%;margin-bottom:1.25em;">
            <input class="search-input"
            type="text" name="q" placeholder="search..." minlength="2" autocomplete="off" value="${searchQuery}">
        </form>
        <div>
            <nav aria-label="Site navigation">
                <div>
                    <a href="${root_url}/" class="logo"><span>⬤</span> <span class="bold" style="margin-left: 0.2em;margin-right:1.5em;">minifeed</span></a>
                    <a href="${root_url}/my" class="${active === "my" ? "bold" : ""}">My feed</a>
                    <a href="${root_url}/global" class="${active === "global" ? "bold" : ""}" style="margin-left: 0.5em">Global feed</a>
                    <a href="${root_url}/blogs" class="${active === "blogs" ? "bold" : ""}" style="margin-left: 0.5em">Blogs</a>
                    <a href="${root_url}/users" class="${active === "users" ? "bold" : ""}" style="margin-left: 0.5em">Users</a>
                </div>
                    ${userBlock}
            </nav>
        </div>
    </header>

    <main>${inner}</main>

    <footer>
        <p>
            Minifeed.net ::
            <a href="${root_url}/about/changelog">changelog</a> /
            <a href="https://status.minifeed.net/">status</a> /
            <a href="${root_url}/feedback">feedback</a>
        </p>
    </footer>

    </body>
    </html>`;
};

const dateFormatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
};

export const renderItemShort = (
    item_sqid: string,
    title: string,
    url: string,
    feed_title: string,
    feed_sqid: string,
    pub_date: string = "",
    summary: string = "",
) => {
    const postDate = new Date(pub_date).toLocaleDateString(
        "en-UK",
        dateFormatOptions,
    );

    const feedLink = feed_title
        ? `<a href="/blogs/${feed_sqid}">${feed_title}</a> | `
        : "";
    const summaryContent = summary
        ? `<p class="item-summary">${summary}</p>`
        : "";

    return `
    <div class="item-short">
        <a href="/items/${item_sqid}" class="bold no-color no-underline">${title}</a> <br>
        <div class="muted">
            <small>
                ${feedLink}
                <span>${postDate}</span> |
                <a class="no-underline no-color" href="${url}">original</a>
            </small>
        </div>
        ${summaryContent}
    </div>
    `;
};

export const renderItemSearchResult = (searchResult: any) => {
    const item = searchResult["document"];
    // item_id, title, url, feed_title, feed_id, pub_date=''
    const postDate = new Date(item["pub_date"]).toLocaleDateString(
        "en-UK",
        dateFormatOptions,
    );
    const feedSqid = item["feed_sqid"];
    const itemSqid = item["item_sqid"];
    const uri_root_from_type = item["type"] === "blog" ? "blogs" : "";

    let title = item["title"];
    if (
        searchResult["highlight"]["title"] &&
        searchResult["highlight"]["title"]["snippet"]
    ) {
        title = searchResult["highlight"]["title"]["snippet"];
    }
    let content = "";
    if (
        searchResult["highlight"]["content"] &&
        searchResult["highlight"]["content"]["snippet"]
    ) {
        content = searchResult["highlight"]["content"]["snippet"];
    }

    return `
    <div class="item-short search-result">
        <a href="/items/${itemSqid}" class="no-underline bold">${title}</a> <br>
        <div class="muted"><small>
            from ${item["type"]} <a href="/${uri_root_from_type}/${feedSqid}">${item["feed_title"]}</a> |
            <time>${postDate}</time> |
            <a class="no-underline no-color" href="${item["url"]}">original</a>
        </small></div>
        <p class="item-summary">
        ${content}...
        </p>
    </div>
    `;
};

export const renderAddFeedForm = (url: string = "", flash: string = "") => {
    let flash_test = "";
    if (flash.includes("Cannot find RSS link"))
        flash_test +=
            "Cannot find RSS link on that page. Try entering direct RSS URL.";
    else if (flash.includes("UNIQUE constraint failed: feeds.rss_url"))
        flash_test += "Blog already exists.";
    else if (flash.includes("Cannot fetch url"))
        flash_test += "That page does not exist.";
    else if (flash.includes("error code 530"))
        flash_test += "That page does not exist.";
    else flash_test += flash;

    const flashBlock = flash
        ? html`<div class="flash flash-red">${flash_test}</div>`
        : "";
    return html`
    <h1>Add new blog</h1>
    ${flashBlock}
      <form action="/blogs/new" method="POST">
        <div style="margin-bottom:1em;">
          <label for="url">Blog URL (or direct RSS URL):</label>
          <input
            type="url"
            id="url"
            name="url"
            value="${url}"
            style="width: 100%;"
          /><br />
        </div>
        <input type="submit" value="Add blog" />
      </form>
  `;
};

export const renderAddItemByURLForm = (
    url: string = "",
    urls: string = "",
    flash: string = "",
    blogTitle: string = "",
) => {
    let flash_test = "";
    if (flash.includes("Cannot fetch url"))
        flash_test += "That page does not exist.";
    else flash_test += flash;

    const flashBlock = flash
        ? html`<div class="flash flash-red">${flash_test}</div>`
        : "";
    return html`
    <h1>Add new item by URL to ${blogTitle}</h1>
    ${flashBlock}
    <div class="formbg">
      <form action="new" method="POST">
        <div style="margin-bottom:1em;">
          <label for="url">URL:</label>
          <input
            type="url"
            id="url"
            name="url"
            value="${url}"
            style="width: 100%;"
          />

          <p>Or add multiple URLs separated by new lines:</p>

          <label for="urls">URLs:</label>
          <textarea
            id="urls"
            name="urls"
            rows="7"

            value="${urls}"
            style="width: 100%;resize: vertical;"
          /></textarea><br />
        </div>
        <input type="submit" value="Add item(s)" />
      </form>
    </div>
  `;
};

export const render_my_subsections = (active: string = "all") => {
    return html`
    <nav class="subsections">
        <a href="/my" class="no-color no-underline ${active === "my" ? "active bold" : ""}">all</a>
        <a href="/my/subscriptions" class="no-color no-underline ${active === "subscriptions" ? "active bold" : ""}">subscriptions</a>
        <a href="/my/favorites" class="no-color no-underline ${active === "favorites" ? "active bold" : ""}">favorites</a>
        <a href="/my/friendfeed" class="no-color no-underline ${active === "friendfeed" ? "active bold" : ""}">friendfeed</a>
    </nav>
    `;
}
